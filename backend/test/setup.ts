// Env the Lambda config module requires at import time.
process.env.AWS_REGION = "ap-southeast-2";
process.env.TABLE_NAME = "TestTable";
process.env.RAW_BUCKET = "raw-bucket";
process.env.MEDIA_BUCKET = "media-bucket";
process.env.MEDIA_BASE_URL = "https://cdn.example.com";
process.env.SITE_BASE_URL = "https://app.example.com";
process.env.MEDIACONVERT_ROLE_ARN = "arn:aws:iam::123456789012:role/mc";
process.env.ADMIN_PASSWORD = "s3cr3t-admin-key";
