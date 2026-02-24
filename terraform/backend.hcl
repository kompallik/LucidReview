bucket         = "mhk-terraform-state"
key            = "lucidreview/terraform.tfstate"
region         = "us-east-2"
dynamodb_table = "terraform_state_locking_table"
encrypt        = true
