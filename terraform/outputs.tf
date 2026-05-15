output "lambda_arn" {
  value = aws_lambda_function.shorten.arn
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.urls.name
}

output "api_url" {
  value = "${aws_apigatewayv2_stage.dev.invoke_url}/shorten"
}
