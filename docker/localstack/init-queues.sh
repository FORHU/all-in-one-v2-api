#!/bin/sh
# Runs inside LocalStack each time it becomes ready (mounted into
# /etc/localstack/init/ready.d/). The free image keeps queues in memory, so this
# recreates them on every start. Keep the queue list in sync with QUEUES in
# src/infrastructure/sqs/queues.ts and the *_QUEUE_URL entries in .env.example.
#
# Must stay LF-only (.gitattributes enforces it): a CRLF copy fails inside the
# container with "/bin/sh^M: bad interpreter".
set -eu

REGION="${AWS_DEFAULT_REGION:-ap-southeast-1}"
# Receives before a message moves to its DLQ. The worker reads the same value
# (SQS_MAX_RECEIVE_COUNT) to know which attempt is the last one.
MAX_RECEIVES="${SQS_MAX_RECEIVE_COUNT:-3}"
VISIBILITY_TIMEOUT="${SQS_VISIBILITY_TIMEOUT_SECONDS:-300}"
DLQ_RETENTION_SECONDS=1209600 # 14 days, the SQS maximum — time for a person to look

create_queue() {
  awslocal sqs create-queue --region "$REGION" --queue-name "$1" --query QueueUrl --output text
}

for q in \
  product-sync \
  supplier-refund
do
  dlq_url=$(create_queue "$q-dlq")
  awslocal sqs set-queue-attributes --region "$REGION" --queue-url "$dlq_url" \
    --attributes "MessageRetentionPeriod=$DLQ_RETENTION_SECONDS"
  dlq_arn=$(awslocal sqs get-queue-attributes --region "$REGION" --queue-url "$dlq_url" \
    --attribute-names QueueArn --query Attributes.QueueArn --output text)

  url=$(create_queue "$q")

  # RedrivePolicy is a JSON string inside JSON; a file avoids shell-quoting it.
  cat > /tmp/attributes.json <<EOF
{
  "VisibilityTimeout": "$VISIBILITY_TIMEOUT",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"$dlq_arn\",\"maxReceiveCount\":\"$MAX_RECEIVES\"}"
}
EOF
  awslocal sqs set-queue-attributes --region "$REGION" --queue-url "$url" \
    --attributes file:///tmp/attributes.json

  echo "queue ready: $q (dlq: $q-dlq, max receives: $MAX_RECEIVES, visibility: ${VISIBILITY_TIMEOUT}s, region: $REGION)"
done
