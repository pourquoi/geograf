const cheatsheet = {
  cheatsheet: [
    {
      category: "Select",
      icon: "SelectNode",
      examples: [
        '(col("First Name").trim() + " " + col("Last Name").trim()).alias("Full Name")',
        '(col("Sales") / col("Sales").len() * 100).alias("Sales %")',
        '(col("Message").replace_all("\d", "-").alias("Domain")',
      ],
    },
    {
      category: "Filter",
      icon: "FilterNode",
      examples: [
        'col("Age") >= 18 and col("State").lower().contains("new") and col("Income") > 50000',
        '!col("Age").is_null() and col("Message").extract("@(.*)").len() > 3',
        'col("Message").len() > 100',
      ],
    },
    {
      category: "Aggregate",
      icon: "JoinNode",
      examples: [
        'col("age") >= 18 and col("country") == "France" and col("income") > 50000',
        '(col("sales") / col("total_sales") * 100).alias("pct")',
        '(col("first_name").trim() + " " + col("last_name").trim()).alias("full_name")',
      ],
    },
  ],
  reference: {
    functions: [
      {
        name: "len()",
        example: "len()",
      },
      {
        name: "sum(expression)",
        example: 'sum(col("revenue"))',
      },
      {
        name: "mean(expression)",
        example: 'mean(col("price"))',
      },
      {
        name: "min(expression)",
        example: 'min(col("temperature"))',
      },
      {
        name: "max(expression)",
        example: 'max(col("sales"))',
      },
      {
        name: "count(expression)",
        example: 'count(col("user_id"))',
      },
    ],
    methods: [
      {
        name: ".alias(string)",
        example: 'col("name").alias("full_name")',
      },
      { name: ".is_null()", example: 'col("email").is_null()' },
      { name: ".is_not_null()", example: 'col("email").is_null()' },
      { name: ".is_nan()", example: 'col("email").is_nan()' },
      { name: ".eq()", example: 'col("status").eq("active")' },
      { name: ".upper()", example: 'col("country").upper()' },
      { name: ".lower()", example: 'col("tag").lower()' },
      { name: ".trim()", example: 'col("username").trim()' },
      { name: ".to_titlecase()", example: 'col("name").to_titlecase()' },
      {
        name: ".contains(regex)",
        example: 'col("email").contains("@gmail\\\\.com$")',
      },
      {
        name: ".starts_with(substring)",
        example: 'col("code").starts_with("US-")',
      },
      {
        name: ".ends_with(substring)",
        example: 'col("file").ends_with(".pdf")',
      },
      {
        name: ".strip_chars(chars)",
        example: 'col("phone").strip_chars(" -()")',
      },
      { name: ".strip_chars_end()", example: 'col("path").strip_chars_end()' },
      {
        name: ".strip_chars_start()",
        example: 'col("url").strip_chars_start()',
      },
      { name: ".strip_prefix()", example: 'col("id").strip_prefix("user_")' },
      { name: ".strip_suffix()", example: 'col("image").strip_suffix(".tmp")' },
      {
        name: ".replace(regex)",
        example: 'col("text").replace("\\\\s+", " ")',
      },
      {
        name: ".replace_all(regex)",
        example: 'col("log").replace_all("\\\\d+", "<NUM>")',
      },
      {
        name: ".extract(regex)",
        example: 'col("url").extract("https?://([^/]+)", 1)',
      },
      {
        name: ".fill_null(value)",
        example: 'col("age").fill_null(col("age").mean())',
      },
      {
        name: ".fill_null_forward()",
        example: 'col("age").fill_null_forward()',
      },
      {
        name: ".fill_null_backward()()",
        example: 'col("age").fill_null_backward()',
      },
      {
        name: ".fill_null_mean()",
        example: 'col("age").fill_null_mean()',
      },
      {
        name: ".fill_null_max()",
        example: 'col("age").fill_null_max()',
      },
      {
        name: ".fill_null_min()",
        example: 'col("age").fill_null_min()',
      },
      { name: ".cast(type)", example: 'col("age_str").cast("Int32")' },
      {
        name: ".to_datetime(format)",
        example: 'col("date").to_datetime("%Y-%m-%d %H:%M:%S")',
      },
      { name: ".to_date(format)", example: 'col("date").to_date("%Y-%m-%d")' },
      { name: ".year()", example: 'col("date").year()' },
      { name: ".month()", example: 'col("date").month()' },
      { name: ".day()", example: 'col("date").day()' },
      { name: ".hour()", example: 'col("date").hour()' },
      { name: ".minute()", example: 'col("date").minute()' },
      { name: ".second()", example: 'col("date").second()' },
      { name: ".mode()", example: 'col("category").mode()' },
      { name: ".n_unique()", example: 'col("category").n_unique()' },
      { name: ".abs()", example: 'col("profit").abs()' },
      { name: ".round(decimals)", example: 'col("price").round(2)' },
      { name: ".sum()", example: 'col("amount").sum()' },
      { name: ".mean()", example: 'col("score").mean()' },
      { name: ".min()", example: 'col("temp").min()' },
      { name: ".max()", example: 'col("temp").max()' },
      { name: ".median()", example: 'col("salary").median()' },
      { name: ".std()", example: 'col("value").std()' },
      { name: ".count()", example: 'col("id").count()' },
      { name: ".first()", example: 'col("id").first()' },
      { name: ".last()", example: 'col("id").last()' },
    ],
  },
};

export default cheatsheet;
