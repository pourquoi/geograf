use crate::expressions::ast_to_expr;

use super::ExpressionError;
use super::{AstExpr, BinaryOp, LitValue, UnaryOp};
use pest::iterators::{Pair, Pairs};
use pest::pratt_parser::PrattParser;
use pest::Parser;
use pest_derive::Parser;
use std::str::FromStr;

lazy_static::lazy_static! {
    static ref PRATT_PARSER: PrattParser<Rule> = {
        use pest::pratt_parser::{Assoc::*, Op};
        use Rule::*;

        // Precedence is defined lowest to highest
        PrattParser::new()
            .op(Op::infix(logical_or, Left))
            .op(Op::infix(logical_and, Left))
            .op(Op::infix(add, Left) | Op::infix(subtract, Left))
            .op(Op::infix(multiply, Left) | Op::infix(divide, Left))
            .op(Op::infix(gt, Left) | Op::infix(lt, Left))
            .op(Op::infix(ge, Left) | Op::infix(le, Left))
            .op(Op::infix(eq, Left) | Op::infix(ne, Left))
            .op(Op::prefix(logical_not) | Op::prefix(neg))
            .op(Op::postfix(dot_method))
    };
}

#[derive(Parser)]
#[grammar = "expressions/grammar.pest"]
struct ExprParser;

pub fn parse_program(input: &str) -> Result<AstExpr, ExpressionError> {
    let pairs = ExprParser::parse(Rule::program, input).map_err(|e| {
        let msg = e
            .renamed_rules(|rule| match *rule {
                Rule::primary => "expression".into(),
                Rule::neg => "-".into(),
                Rule::logical_and => "&&".into(),
                Rule::logical_or => "||".into(),
                Rule::logical_not => "!".into(),
                Rule::add => "+".into(),
                Rule::subtract => "-".into(),
                Rule::multiply => "*".into(),
                Rule::divide => "/".into(),
                Rule::gt => ">".into(),
                Rule::lt => "<".into(),
                Rule::ge => ">=".into(),
                Rule::le => "<=".into(),
                Rule::eq => "==".into(),
                Rule::ne => "!=".into(),
                Rule::dot_method => "method call".into(),
                Rule::col_call => "col".into(),
                Rule::lit_call => "lit".into(),
                Rule::EOI => "end of input".into(),
                other => format!("{:?}", other),
            })
            .to_string();

        ExpressionError::ParseError {
            msg,
            span: (0, input.len()),
        }
    })?;

    let program = pairs
        .into_iter()
        .next()
        .ok_or(ExpressionError::ParseError {
            msg: "empty input".into(),
            span: (0, input.len()),
        })?;
    let expr = program.into_inner().next().unwrap();

    parse_expr(expr.into_inner())
}

fn parse_expr(pairs: Pairs<Rule>) -> Result<AstExpr, ExpressionError> {
    PRATT_PARSER
        .map_primary(|primary| parse_primary(primary))
        .map_infix(|lhs, op, rhs| {
            Ok(AstExpr::BinaryOp {
                op: BinaryOp::from_str(op.as_str()).unwrap(),
                left: Box::new(lhs?),
                right: Box::new(rhs?),
            })
        })
        .map_prefix(|op, rhs| {
            Ok(AstExpr::UnaryOp {
                op: UnaryOp::from_str(op.as_str()).unwrap(),
                rhs: Box::new(rhs?),
            })
        })
        .parse(pairs)
}

fn parse_primary(pair: Pair<Rule>) -> Result<AstExpr, ExpressionError> {
    match pair.as_rule() {
        Rule::expr => parse_expr(pair.into_inner()),
        Rule::primary => {
            let mut pairs = pair.into_inner();

            let mut expr = {
                let atom = pairs.next().unwrap();

                match atom.as_rule() {
                    Rule::function_call => parse_function(atom),
                    Rule::expr => parse_expr(atom.into_inner()),
                    Rule::ident => Ok(AstExpr::Ident(atom.as_str().to_string())),
                    Rule::number => parse_number(atom),
                    Rule::string => Ok(AstExpr::Lit(LitValue::Str(unquote(atom.as_str())))),

                    other => Err(ExpressionError::ParseError {
                        msg: format!("unhandled rule: {:?}", other),
                        span: (atom.as_span().start(), atom.as_span().end()),
                    }),
                }?
            };

            // handle optional dot methods (.alias("a"), .to_uppercase() ...)
            for dot_pair in pairs {
                let mut dot_inner = dot_pair.into_inner();

                let method_name = dot_inner.next().unwrap().as_str().to_string();

                let args = dot_inner
                    .next() // consume "."
                    .into_iter()
                    .flat_map(|ca| ca.into_inner().next()) // optional arg_list
                    .flat_map(|al| al.into_inner())
                    .map(|p| parse_expr(p.into_inner()))
                    .collect::<Result<Vec<_>, _>>()
                    .into_iter()
                    .flatten()
                    .collect();

                expr = AstExpr::MethodCall {
                    receiver: Box::new(expr),
                    method: method_name,
                    args,
                };
            }
            Ok(expr)
        }
        _ => Err(ExpressionError::Unsupported {
            name: pair.as_str().into(),
            span: (pair.as_span().start(), pair.as_span().end()),
            rule: Some("primary".into()),
        }),
    }
}

fn parse_col(pair: Pair<Rule>) -> Result<AstExpr, ExpressionError> {
    let span = pair.as_span();
    let inner = pair.into_inner().next().unwrap();
    if inner.as_rule() != Rule::string {
        return Err(ExpressionError::ParseError {
            msg: "col() expects string".into(),
            span: (span.start(), span.end()),
        });
    }
    Ok(AstExpr::Col(unquote(inner.as_str())))
}

fn parse_lit(pair: Pair<Rule>) -> Result<AstExpr, ExpressionError> {
    let inner = pair.into_inner().next().unwrap();
    match inner.as_rule() {
        Rule::string => Ok(AstExpr::Lit(LitValue::Str(unquote(inner.as_str())))),
        Rule::number => {
            let t = inner.as_str();
            if t.contains('.') {
                Ok(AstExpr::Lit(LitValue::Float(t.parse().map_err(|_| {
                    ExpressionError::IllegalArgument(format!("invalid float: {}", t))
                })?)))
            } else {
                Ok(AstExpr::Lit(LitValue::Int(t.parse().map_err(|_| {
                    ExpressionError::IllegalArgument(format!("invalid int: {}", t))
                })?)))
            }
        }
        _ => Err(ExpressionError::ParseError {
            msg: "invalid lit arg".into(),
            span: (inner.as_span().start(), inner.as_span().end()),
        }),
    }
}

fn parse_number(pair: Pair<Rule>) -> Result<AstExpr, ExpressionError> {
    let t = pair.as_str();
    if t.contains('.') {
        Ok(AstExpr::Lit(LitValue::Float(t.parse().map_err(|_| {
            ExpressionError::IllegalArgument(format!("invalid float: {}", t))
        })?)))
    } else {
        Ok(AstExpr::Lit(LitValue::Int(t.parse().map_err(|_| {
            ExpressionError::IllegalArgument(format!("invalid int: {}", t))
        })?)))
    }
}

fn parse_function(pair: Pair<Rule>) -> Result<AstExpr, ExpressionError> {
    let mut inner = pair.into_inner();

    let name_pair = inner.next().unwrap();
    let span = name_pair.as_span();

    match name_pair.as_rule() {
        Rule::col_call => parse_col(name_pair),
        Rule::lit_call => parse_lit(name_pair),
        Rule::ident => {
            let fn_name = name_pair.as_str().to_lowercase();
            let mut args = vec![];
            if let Some(arg_list_pair) = inner.next() {
                for a in arg_list_pair.into_inner() {
                    if a.as_rule() == Rule::arg_list {
                        args.push(parse_expr(a.into_inner())?);
                    }
                }
            }
            Ok(AstExpr::Call {
                func: fn_name,
                args,
            })
        }
        _ => Err(ExpressionError::Unsupported {
            name: name_pair.as_str().into(),
            span: (span.start(), span.end()),
            rule: Some("function_call".into()),
        }),
    }
}

fn unquote(s: &str) -> String {
    let s = s.trim();
    if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
        s[1..s.len() - 1].replace("\\\"", "\"")
    } else {
        s.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    lazy_static::lazy_static! {
        static ref DATASET_PATH: String = format!(
            "{}/{}",
            env!("CARGO_MANIFEST_DIR"),
            "/data-test/customers-100.csv"
        );
    }

    fn rt(s: &str) -> AstExpr {
        parse_program(s).unwrap()
    }

    #[test]
    fn test_alias() {
        let ast = rt(r#"col("a").alias("a2")"#);
        assert!(matches!(ast, AstExpr::MethodCall { method, .. } if method == "alias"));
    }

    #[test]
    fn test_upper() {
        let ast = rt(r#"col("name").to_uppercase()"#);
        assert!(matches!(ast, AstExpr::MethodCall { method, .. } if method == "to_uppercase"));
    }

    #[test]
    fn test_arith() {
        let ast = rt(r#"col("a") * lit(2) + col("b") / lit(3)"#);
        assert!(matches!(ast, AstExpr::BinaryOp { op, .. } if op == BinaryOp::Add));

        let ast = rt(r#"col("a") * 2"#);
        assert!(matches!(ast, AstExpr::BinaryOp { ref op, .. } if *op == BinaryOp::Mul));
        assert!(
            matches!(ast, AstExpr::BinaryOp { right, .. } if matches!(right.as_ref(), AstExpr::Lit(LitValue::Int(2))))
        );
    }

    #[test]
    fn test_lit() {
        let ast = rt(r#"2"#);
        assert!(matches!(ast, AstExpr::Lit(LitValue::Int(2))));
        let ast = rt(r#""foo""#);
        assert!(matches!(ast, AstExpr::Lit(LitValue::Str(s)) if s == "foo"));
    }

    #[test]
    fn test_equal() {
        let ast = rt(r#"col("a") == "b""#);
        assert!(matches!(
            ast,
            AstExpr::BinaryOp {
                op: BinaryOp::Eq,
                ..
            }
        ));
        assert!(
            matches!(ast, AstExpr::BinaryOp { left, .. } if matches!(left.as_ref(), AstExpr::Col(col) if col == "a"))
        );
    }

    #[test]
    fn test_cmp() {
        let ast = rt(r#"col("a") > 2"#);
        assert!(matches!(
            ast,
            AstExpr::BinaryOp {
                op: BinaryOp::Gt,
                ..
            }
        ));
        assert!(
            matches!(ast, AstExpr::BinaryOp { right, .. } if matches!(right.as_ref(), AstExpr::Lit(col) if col == &LitValue::Int(2)))
        );
    }

    #[test]
    fn test_func() {
        let e = rt(r#"count(col("First Name"))"#);
        assert!(matches!(e, AstExpr::Call { ref func, .. } if func == "count"));
        assert!(matches!(e, AstExpr::Call { ref args, .. } if args.len() == 1));
        assert!(
            matches!(e, AstExpr::Call { args, .. } if args[0] == AstExpr::Col("First Name".to_string()))
        );
    }

    #[test]
    fn test_not() {
        let e = rt(r#"!col("a").is_null()"#);
        assert!(matches!(e, AstExpr::UnaryOp { op, .. } if op == UnaryOp::Not));
        let e = rt(r#"!(col("a").is_null())"#);
        assert!(matches!(e, AstExpr::UnaryOp { op, .. } if op == UnaryOp::Not));
    }

    #[test]
    fn test_or() {
        let e = rt(r#"col("a") || col("b")"#);
        assert!(matches!(e, AstExpr::BinaryOp { op, .. } if op == BinaryOp::Or));
        let e = rt(r#"col("a") or col("b")"#);
        assert!(matches!(e, AstExpr::BinaryOp { op, .. } if op == BinaryOp::Or));
    }

    #[test]
    fn test_and() {
        let e = rt(r#"col("a") && col("b")"#);
        assert!(matches!(e, AstExpr::BinaryOp { op, .. } if op == BinaryOp::And));
        let e = rt(r#"col("a") and col("b")"#);
        assert!(matches!(e, AstExpr::BinaryOp { op, .. } if op == BinaryOp::And));
    }

    #[test]
    fn test_sub_infix_prefix() {
        let e = rt(r#"col("a") - col("b")"#);
        assert!(matches!(e, AstExpr::BinaryOp { op, .. } if op == BinaryOp::Sub));
        let e = rt(r#"-col("b")"#);
        assert!(matches!(e, AstExpr::UnaryOp { op, .. } if op == UnaryOp::Neg));
    }

    #[rstest]
    #[case(r#"(col("Name").len() * (col("Survived") + 0.5)).alias("r")"#)]
    #[case(r#"(col("Name").len() * (col("Survived") - 0.5)).alias("r")"#)]
    fn test_pratt_no_panic(#[case] expr: &str) {
        println!("{}", expr);
        _ = rt(expr);
    }
}
