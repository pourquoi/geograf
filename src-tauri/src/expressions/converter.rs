use super::ExpressionError;
use super::{AstExpr, BinaryOp, LitValue, UnaryOp};
use polars::prelude::*;

pub fn ast_to_expr(ast: &AstExpr) -> Result<Expr, ExpressionError> {
    match ast {
        AstExpr::Col(name) => Ok(col(name)),
        AstExpr::Lit(LitValue::Int(i)) => Ok(lit(*i)),
        AstExpr::Lit(LitValue::Float(f)) => Ok(lit(*f)),
        AstExpr::Lit(LitValue::Str(s)) => Ok(lit(s.clone())),
        AstExpr::Ident(n) => Err(ExpressionError::Unsupported {
            name: n.to_string(),
            span: (0, 0),
            rule: Some("ident".into()),
        }),

        AstExpr::UnaryOp { op, rhs } => {
            let e = ast_to_expr(rhs)?;
            match op {
                UnaryOp::Neg => Ok(-e),
                UnaryOp::Not => Ok(not(e)),
            }
        }

        AstExpr::BinaryOp { left, op, right } => {
            let l = ast_to_expr(left)?;
            let r = ast_to_expr(right)?;
            match op {
                BinaryOp::Add => Ok(l + r),
                BinaryOp::Sub => Ok(l - r),
                BinaryOp::Mul => Ok(l * r),
                BinaryOp::Div => Ok(l / r),
                BinaryOp::Eq => Ok(l.eq(r)),
                BinaryOp::Ne => Ok(l.neq(r)),
                BinaryOp::Lt => Ok(l.lt(r)),
                BinaryOp::Le => Ok(l.lt_eq(r)),
                BinaryOp::Gt => Ok(l.gt(r)),
                BinaryOp::Ge => Ok(l.gt_eq(r)),
                BinaryOp::And => Ok(l.and(r)),
                BinaryOp::Or => Ok(l.or(r)),
            }
        }

        AstExpr::Call { func, args } => {
            let name = func.to_lowercase();
            match name.as_str() {
                "len" => {
                    if !args.is_empty() {
                        return Err(ExpressionError::IllegalArgument(format!(
                            "{}() expects 0 arg",
                            func
                        )));
                    }
                    Ok(len())
                }
                "sum" | "mean" | "min" | "max" | "count" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(format!(
                            "{}() expects 1 arg",
                            func
                        )));
                    }
                    let e = ast_to_expr(args.into_iter().next().unwrap())?;
                    match name.as_str() {
                        "sum" => Ok(e.sum()),
                        "mean" => Ok(e.mean()),
                        "min" => Ok(e.min()),
                        "max" => Ok(e.max()),
                        "count" => Ok(e.count()),
                        _ => unreachable!(),
                    }
                }
                "lit" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(
                            "lit() expects 1 arg".into(),
                        ));
                    }
                    match args.into_iter().next().unwrap() {
                        AstExpr::Lit(LitValue::Int(i)) => Ok(lit(*i)),
                        AstExpr::Lit(LitValue::Float(f)) => Ok(lit(*f)),
                        AstExpr::Lit(LitValue::Str(s)) => Ok(lit(s.clone())),
                        other => Err(ExpressionError::IllegalArgument(format!(
                            "lit must be literal: {:?}",
                            other
                        ))),
                    }
                }
                other => Err(ExpressionError::Unsupported {
                    name: other.into(),
                    span: (0, 0),
                    rule: Some("function_call".into()),
                }),
            }
        }

        AstExpr::MethodCall {
            receiver,
            method,
            args,
        } => {
            let method_lower = method.to_lowercase();
            match method_lower.as_str() {
                "alias" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(
                            r#"alias(name) expects 1 string arg: alias("My Alias")"#.into(),
                        ));
                    }
                    let alias = match &args[0] {
                        AstExpr::Lit(LitValue::Str(s)) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                r#"alias(name): name requires string literal, got {:?}: alias("My Alias")"#,
                                args[0]
                            )))
                        }
                    };
                    let recv = ast_to_expr(receiver)?;
                    Ok(recv.alias(&alias))
                }

                "is_null" => Ok(ast_to_expr(receiver)?.is_null()),
                "is_not_null" => Ok(ast_to_expr(receiver)?.is_not_null()),
                "is_nan" => Ok(ast_to_expr(receiver)?.is_nan()),

                "n_unique" => Ok(ast_to_expr(receiver)?.n_unique()),

                "first" => Ok(ast_to_expr(receiver)?.first()),
                "last" => Ok(ast_to_expr(receiver)?.last()),

                "fill_null" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(
                            "fill_null() expects 1 arg".into(),
                        ));
                    }
                    let fill_value = ast_to_expr(&args[0].clone())?;
                    let recv = ast_to_expr(receiver)?;
                    Ok(recv.fill_null(fill_value))
                }

                func @ ("fill_null_forward" | "fill_null_backward" | "fill_null_mean"
                | "fill_null_min" | "fill_null_max") => {
                    if !args.is_empty() {
                        return Err(ExpressionError::IllegalArgument(
                            "fill_null_forward() expects 0 arg".into(),
                        ));
                    }
                    let recv = ast_to_expr(receiver)?;
                    Ok(recv.fill_null_with_strategy(match func {
                        "fill_null_forward" => FillNullStrategy::Forward(None),
                        "fill_null_backward" => FillNullStrategy::Backward(None),
                        "fill_null_mean" => FillNullStrategy::Mean,
                        "fill_null_min" => FillNullStrategy::Min,
                        "fill_null_max" => FillNullStrategy::Max,
                        _ => unreachable!(),
                    }))
                }

                "eq" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(
                            "eq() expects 1 arg".into(),
                        ));
                    }
                    let right = ast_to_expr(&args[0].clone())?;
                    let recv = ast_to_expr(receiver)?;
                    Ok(recv.eq(right))
                }

                "abs" => Ok(ast_to_expr(receiver)?.abs()),

                "mode" => Ok(ast_to_expr(receiver)?.mode()),

                "to_uppercase" | "upper" => Ok(ast_to_expr(receiver)?.str().to_uppercase()),
                "to_lowercase" | "lower" => Ok(ast_to_expr(receiver)?.str().to_lowercase()),
                "trim" => Ok(ast_to_expr(receiver)?.str().strip_chars(lit(" "))),

                "to_titlecase" | "title" => {
                    let recv = ast_to_expr(receiver)?;
                    Ok(recv.clone().str().head(lit(1))
                        + recv
                            .clone()
                            .str()
                            .slice(lit(1), recv.clone().str().len_chars()))
                }

                func @ ("contains" | "starts_with" | "ends_with" | "strip_chars"
                | "strip_chars_end" | "strip_chars_start" | "strip_prefix"
                | "strip_suffix") => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(format!(
                            r#"{}(value) expects 1 arg: {}("abc")"#,
                            func, func
                        )));
                    }
                    let pat = match &args[0] {
                        AstExpr::Lit(LitValue::Str(s)) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                r#"{}(value): value requires string literal, got {:?}: {}("abc")"#,
                                func, args[0], func
                            )))
                        }
                    };
                    let recv = ast_to_expr(receiver)?;
                    match func {
                        "contains" => Ok(recv.str().contains(lit(pat), false)),
                        "starts_with" => Ok(recv.str().starts_with(lit(pat))),
                        "ends_with" => Ok(recv.str().ends_with(lit(pat))),
                        "strip_chars" => Ok(recv.str().strip_chars(lit(pat))),
                        "strip_chars_end" => Ok(recv.str().strip_chars_end(lit(pat))),
                        "strip_chars_start" => Ok(recv.str().strip_chars_start(lit(pat))),
                        "strip_prefix" => Ok(recv.str().strip_prefix(lit(pat))),
                        "strip_suffix" => Ok(recv.str().strip_suffix(lit(pat))),
                        _ => unreachable!(),
                    }
                }

                func @ ("replace" | "replace_all") => {
                    if args.len() != 2 {
                        return Err(ExpressionError::IllegalArgument(format!(
                            r#"{}(pattern, value) expects 2 args: {}("\w+\.\w+@(\w{{2,3}})", "***@$1")"#,
                            func, func
                        )));
                    }
                    let pat = match &args[0] {
                        AstExpr::Lit(LitValue::Str(s)) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                r#"{}(pattern, value): pattern requires string literal, got {:?}: {}(\"w+\\.w+@(w{{2,3}})\", "***@$1")"#,
                                func, args[0], func
                            )))
                        }
                    };
                    let repl = match &args[1] {
                        AstExpr::Lit(LitValue::Str(s)) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                r#"{}(pattern, value): value requires string literal, got {:?}: {}(\"w+\\.w+@(w{{2,3}})\", "***@$1")"#,
                                func, args[1], func
                            )))
                        }
                    };
                    let recv = ast_to_expr(receiver)?;
                    match func {
                        "replace" => Ok(recv.str().replace(lit(pat), lit(repl), true)),
                        "replace_all" => Ok(recv.str().replace_all(lit(pat), lit(repl), true)),
                        _ => unreachable!(),
                    }
                }

                "extract" => {
                    if args.len() != 1 && args.len() != 2 {
                        return Err(ExpressionError::IllegalArgument(
                            r#"extract(pattern, [group_index]) expects 1 or 2 args: extract("\d+")"#.to_string(),
                        ));
                    }
                    let pat = match &args[0] {
                        AstExpr::Lit(LitValue::Str(s)) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                r#"extract(pattern, [group_index]): pattern requires string literal, got {:?}: extract("\d+")"#,
                                args[0]
                            )))
                        }
                    };
                    let group_index = if args.len() == 2 {
                        match &args[1] {
                            AstExpr::Lit(LitValue::Int(s)) => *s as usize,
                            _ => {
                                return Err(ExpressionError::IllegalArgument(format!(
                                "extract(pattern, group_index): group_index requires integer, got {:?}",
                                args[1]
                            )))
                            }
                        }
                    } else {
                        1_usize
                    };

                    let recv = ast_to_expr(receiver)?;
                    Ok(recv.str().extract(lit(pat), group_index))
                }

                "lengths" | "len" => {
                    let recv = ast_to_expr(receiver)?;
                    Ok(recv.str().len_chars())
                }

                "str" | "dt" | "arr" | "meta" | "struct" => ast_to_expr(receiver),

                "cast" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(
                            "cast(type) expects 1 arg".into(),
                        ));
                    }
                    let typ = match &args[0] {
                        AstExpr::Lit(LitValue::Str(s)) => s.clone(),
                        AstExpr::Ident(s) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                "cast(type): type requires string literal, got {:?}",
                                args[0]
                            )))
                        }
                    };
                    let recv = ast_to_expr(receiver)?;
                    match typ.to_lowercase().as_str() {
                        "i8" | "int8" => Ok(recv.cast(DataType::Int8)),
                        "i16" | "int16" => Ok(recv.cast(DataType::Int16)),
                        "i32" | "int32" => Ok(recv.cast(DataType::Int32)),
                        "i64" | "int64" | "int" => Ok(recv.cast(DataType::Int64)),
                        "u8" | "uint8" => Ok(recv.cast(DataType::UInt8)),
                        "u16" | "uint16" => Ok(recv.cast(DataType::UInt16)),
                        "u32" | "uint32" => Ok(recv.cast(DataType::UInt32)),
                        "u64" | "uint64" | "uint" => Ok(recv.cast(DataType::UInt64)),
                        "f32" | "float32" => Ok(recv.cast(DataType::Float32)),
                        "f64" | "float64" | "float" => Ok(recv.cast(DataType::Float64)),
                        "bool" | "boolean" => Ok(recv.cast(DataType::Boolean)),
                        "str" | "string" => Ok(recv.cast(DataType::String)),
                        _ => Err(ExpressionError::IllegalArgument(format!(
                            r#"cast(type): invalid type {}: supported types are "int", "float", "bool", "str""#,
                            typ
                        ))),
                    }
                }

                "to_datetime" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(
                            "to_datetime() expects 1 arg".into(),
                        ));
                    }
                    let format = match &args[0] {
                        AstExpr::Lit(LitValue::Str(s)) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                "to_datetime(format): format requires string literal, got {:?}",
                                args[0]
                            )))
                        }
                    };

                    let recv = ast_to_expr(receiver)?;
                    let ambiguous = AstExpr::Lit(LitValue::Str("earliest".into()));

                    let res = recv.str().to_datetime(
                        None,
                        None,
                        StrptimeOptions {
                            format: Some(format.into()),
                            strict: false,
                            exact: false,
                            ..Default::default()
                        },
                        ast_to_expr(&ambiguous)?,
                    );
                    Ok(res)
                }

                "to_date" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(
                            "to_date() expects 1 arg".into(),
                        ));
                    }
                    let format = match &args[0] {
                        AstExpr::Lit(LitValue::Str(s)) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                "to_date(format): format requires string literal, got {:?}",
                                args[0]
                            )))
                        }
                    };

                    let recv = ast_to_expr(receiver)?;
                    let recv = recv.str().to_date(StrptimeOptions {
                        format: Some(format.into()),
                        strict: false,
                        exact: false,
                        ..Default::default()
                    });
                    Ok(recv)
                }

                func @ ("year" | "month" | "day" | "hour" | "minute" | "second") => {
                    if !args.is_empty() {
                        return Err(ExpressionError::IllegalArgument(format!(
                            "{}() expects 0 arg",
                            func
                        )));
                    }
                    let recv = ast_to_expr(receiver)?;
                    match func {
                        "year" => Ok(recv.dt().year()),
                        "month" => Ok(recv.dt().month()),
                        "day" => Ok(recv.dt().day()),
                        "hour" => Ok(recv.dt().hour()),
                        "minute" => Ok(recv.dt().minute()),
                        "second" => Ok(recv.dt().second()),
                        _ => unreachable!(),
                    }
                }

                func @ ("sum" | "mean" | "min" | "max" | "std" | "median" | "count") => {
                    if !args.is_empty() {
                        return Err(ExpressionError::IllegalArgument(format!(
                            "{}() expects 0 arg",
                            func
                        )));
                    }
                    let recv = ast_to_expr(receiver)?;
                    match func {
                        "sum" => Ok(recv.sum()),
                        "mean" => Ok(recv.mean()),
                        "min" => Ok(recv.min()),
                        "max" => Ok(recv.max()),
                        "median" => Ok(recv.median()),
                        "count" => Ok(recv.count()),
                        "std" => Ok(recv.std(1)),
                        _ => unreachable!(),
                    }
                }

                func @ "round" => {
                    if args.len() != 1 {
                        return Err(ExpressionError::IllegalArgument(format!(
                            "{}(precision): expects 1 arg",
                            func
                        )));
                    }
                    let precision = match &args[0] {
                        AstExpr::Lit(LitValue::Int(s)) => s.clone(),
                        _ => {
                            return Err(ExpressionError::IllegalArgument(format!(
                                "{}(precision): precision requires integer, got {:?}",
                                func, args[0]
                            )))
                        }
                    };
                    let recv = ast_to_expr(receiver)?;
                    match func {
                        "round" => Ok(recv.round(precision as u32, RoundMode::HalfToEven)),
                        _ => unreachable!(),
                    }
                }

                other => Err(ExpressionError::Unsupported {
                    name: other.into(),
                    span: (0, 0),
                    rule: Some("method_call".into()),
                }),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::expressions::{AstExpr, LitValue};

    lazy_static::lazy_static! {
        static ref DATASET_PATH: String = format!(
            "{}/{}",
            env!("CARGO_MANIFEST_DIR"),
            "/data-test/customers-100.csv"
        );
    }

    fn df() -> LazyFrame {
        let path = PlPath::from_string(DATASET_PATH.clone());

        LazyCsvReader::new(path)
            .with_has_header(true)
            .finish()
            .unwrap()
    }

    #[test]
    fn test_col_alias() {
        let df = df();

        let ast = AstExpr::Col("Customer Id".to_string());
        let ast = AstExpr::MethodCall {
            receiver: Box::new(ast),
            method: String::from("alias"),
            args: vec![AstExpr::Lit(LitValue::Str(String::from("id")))],
        };
        let e = ast_to_expr(&ast).unwrap();

        let filtered = df.select([e]).collect().unwrap();
        assert!(filtered.height() > 0);
    }

    #[test]
    fn test_call() {
        let df = df();

        let ast = AstExpr::Col("Index".to_string());
        let ast = AstExpr::Call {
            args: vec![ast],
            func: String::from("sum"),
        };
        let e = ast_to_expr(&ast).unwrap();

        let filtered = df.select([e]).collect().unwrap();
        assert!(filtered.height() > 0);
    }

    #[test]
    fn test_dot_method() {
        let df = df();

        let ast = AstExpr::Col("First Name".to_string());
        let ast = AstExpr::MethodCall {
            receiver: Box::new(ast),
            method: String::from("eq"),
            args: vec![AstExpr::Lit(LitValue::Str(String::from("Sheryl")))],
        };
        let e = ast_to_expr(&ast).unwrap();

        let filtered = df.filter(e).collect().unwrap();
        assert!(filtered.height() > 0);
    }

    #[test]
    fn test_strings() {
        let df = df();

        let ast = AstExpr::MethodCall {
            receiver: Box::new(AstExpr::Col("First Name".to_string())),
            method: String::from("to_uppercase"),
            args: vec![],
        };
        let e = ast_to_expr(&ast).unwrap();

        let filtered = df.clone().select([e]).collect().unwrap();
        assert!(filtered.height() > 0);

        let ast = AstExpr::MethodCall {
            receiver: Box::new(AstExpr::Col("Email".to_string())),
            method: String::from("title"),
            args: vec![],
        };
        let e = ast_to_expr(&ast).unwrap();

        let filtered = df.clone().select([e]).collect().unwrap();
        assert!(filtered.height() > 0);
    }
}
