#!/usr/bin/env bash
# Shows why an upload might be stuck: recent MediaConvert jobs (with any error
# message) + the two transcode Lambdas' logs. Run from the repo root:
#   ./tools/diagnose.sh
set -uo pipefail

REGION=$(aws configure get region 2>/dev/null || echo ap-southeast-2)
echo "Region: $REGION"

echo
echo "==================== Recent MediaConvert jobs ===================="
# Account-agnostic regional endpoint (no DescribeEndpoints needed).
EP="https://mediaconvert.$REGION.amazonaws.com"
aws mediaconvert list-jobs --endpoint-url "$EP" --region "$REGION" --max-results 8 --order DESCENDING \
  --query 'Jobs[].{Status:Status,Error:ErrorMessage,Video:UserMetadata.videoId,Submitted:Timing.SubmitTime}' \
  --output table \
  || echo "(couldn't list jobs — if this says AccessDenied, your CLI user just lacks MediaConvert read perms; the Lambda is unaffected)"

dump_logs () {
  local match="$1" label="$2"
  echo
  echo "==================== $label logs (last 1h) ===================="
  local lg
  lg=$(aws logs describe-log-groups --region "$REGION" \
        --query "logGroups[?contains(logGroupName,'$match')].logGroupName | [0]" --output text 2>/dev/null || true)
  if [ -n "${lg:-}" ] && [ "$lg" != "None" ]; then
    aws logs tail "$lg" --since 1h --region "$REGION" --format short 2>/dev/null || echo "(no recent events)"
  else
    echo "No log group found for $label yet (has it run?)."
  fi
}

dump_logs "OnRawUploadFn"     "onRawUpload (starts transcode)"
dump_logs "OnTranscodeDoneFn" "onTranscodeDone (marks live)"

echo
echo "Tip: a MediaConvert job in ERROR shows why in the Error column above."
echo "     COMPLETE jobs but a still-'processing' wall → look at onTranscodeDone."
echo "     No jobs at all → look at onRawUpload (or the S3→Lambda trigger)."
