# food-aws

Food tracking PWA for Felipe. Dark-themed, mobile-first, installable on iPhone.

## Stack

- **Frontend**: PWA (Chart.js) at `food.felipetan.com` via CloudFront + S3
- **API**: API Gateway v2 + Lambda (TypeScript)
- **DB**: DynamoDB single-table (`date` PK, `entryId` SK)
- **Infra**: AWS CDK, stack name `FoodStack`, region `ap-northeast-1`

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/entries` | `x-api-key` | Create food entry |
| GET | `/entries?date=YYYY-MM-DD` | public | Get entries for a day |
| DELETE | `/entries/{entryId}?date=YYYY-MM-DD` | `x-api-key` | Delete entry |
| GET | `/summary?days=N` | public | Weekly calorie summary |

## Deploy

```bash
cd lambda && npx esbuild api.ts --bundle --platform=node --target=node20 --outfile=dist/api.js
cd ../cdk && npx cdk deploy FoodStack -c apiKey=<key> --require-approval never
./sync-frontend.sh
```

## DNS

Add CNAME: `food.felipetan.com` → `dg5osv4w96kj6.cloudfront.net`
