# 1. Tabla DynamoDB
resource "aws_dynamodb_table" "urls" {
  name         = "${var.project_name}-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "shortId"

  attribute {
    name = "shortId"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# 2. IAM Role para la Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 3. Políticas de IAM (CloudWatch + DynamoDB)
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.urls.arn
      }
    ]
  })
}

# 4. Función Lambda
resource "aws_lambda_function" "shorten" {
  filename      = "../dist/index.zip"
  function_name = "${var.project_name}-${var.environment}"
  role          = aws_iam_role.lambda_role.arn
  handler       = "handler.handler"
  runtime       = "nodejs20.x"

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.urls.name
    }
  }

  # Esto asegura que Terraform detecte cambios en el código
  source_code_hash = fileexists("../dist/index.zip") ? filebase64sha256("../dist/index.zip") : null
}

# 5. API Gateway (v2 HTTP API es más rápida y barata)
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.shorten.invoke_arn
}

resource "aws_apigatewayv2_route" "post_shorten" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /shorten"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# 6. Permiso para que API Gateway invoque a la Lambda
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.shorten.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
