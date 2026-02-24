locals {
  log_groups = {
    backend     = "/ecs/lucidreview/backend"
    reviewer_ui = "/ecs/lucidreview/reviewer-ui"
    hapi_fhir   = "/ecs/lucidreview/hapi-fhir"
    ctakes      = "/ecs/lucidreview/ctakes"
    redis       = "/ecs/lucidreview/redis"
  }
}

resource "aws_cloudwatch_log_group" "services" {
  for_each          = local.log_groups
  name              = each.value
  retention_in_days = var.log_retention_days
}
