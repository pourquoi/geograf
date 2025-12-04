use std::str::FromStr;

#[derive(Debug, Clone, PartialEq)]
pub enum AstExpr {
    Col(String),
    Lit(LitValue),
    Ident(String),
    UnaryOp {
        op: UnaryOp,
        rhs: Box<AstExpr>,
    },
    BinaryOp {
        left: Box<AstExpr>,
        op: BinaryOp,
        right: Box<AstExpr>,
    },
    Call {
        func: String,
        args: Vec<AstExpr>,
    },
    MethodCall {
        receiver: Box<AstExpr>,
        method: String,
        args: Vec<AstExpr>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum UnaryOp {
    Not,
    Neg,
}

impl FromStr for UnaryOp {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "!" => Ok(UnaryOp::Not),
            "not" => Ok(UnaryOp::Not),
            "-" => Ok(UnaryOp::Neg),
            _ => Err(format!("unknown unary op: {}", s)),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum BinaryOp {
    Add,
    Sub,
    Mul,
    Div,
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
    And,
    Or,
}

impl FromStr for BinaryOp {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "+" => Ok(BinaryOp::Add),
            "-" => Ok(BinaryOp::Sub),
            "*" => Ok(BinaryOp::Mul),
            "/" => Ok(BinaryOp::Div),
            "==" => Ok(BinaryOp::Eq),
            "!=" => Ok(BinaryOp::Ne),
            "<" => Ok(BinaryOp::Lt),
            "<=" => Ok(BinaryOp::Le),
            ">" => Ok(BinaryOp::Gt),
            ">=" => Ok(BinaryOp::Ge),
            "&&" => Ok(BinaryOp::And),
            "and" => Ok(BinaryOp::And),
            "||" => Ok(BinaryOp::Or),
            "or" => Ok(BinaryOp::Or),
            _ => Err(format!("unknown binary op: {}", s)),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum LitValue {
    Int(i64),
    Float(f64),
    Str(String),
}
