#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Get stack outputs
STACK_NAME="FoodStack"
REGION="ap-northeast-1"

echo "Fetching stack outputs..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

echo "API URL: $API_URL"
echo "Bucket: $BUCKET"
echo "CloudFront distribution: $DIST_ID"

# Inject API_BASE into index.html and copy to dist
BUILD_DIR="$SCRIPT_DIR/frontend-dist"
rm -rf "$BUILD_DIR"
cp -r "$SCRIPT_DIR/frontend/" "$BUILD_DIR/"

sed -i "s|__API_BASE__|${API_URL}|g" "$BUILD_DIR/index.html"

echo "Syncing to S3..."
aws s3 sync "$BUILD_DIR/" "s3://$BUCKET/" \
  --delete \
  --cache-control "no-cache, no-store, must-revalidate" \
  --region "$REGION"

echo "Invalidating CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --region us-east-1

echo "Done! Frontend synced."
