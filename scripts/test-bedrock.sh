#!/usr/bin/env bash
# Usage: bash scripts/test-bedrock.sh [model-id ...]   (reads .env.local)
# With no args, tries a shortlist and reports which models your key can call.
set -a; . ./.env.local; set +a
R="${AWS_REGION:-us-east-1}"
MODELS=("$@")
[ ${#MODELS[@]} -eq 0 ] && MODELS=(
  us.anthropic.claude-fable-5-2 global.anthropic.claude-fable-5-2
  us.anthropic.claude-opus-5-5 global.anthropic.claude-opus-5-5
  us.anthropic.claude-sonnet-5-5 global.anthropic.claude-sonnet-5-5
  us.anthropic.claude-haiku-5-5
)
for M in "${MODELS[@]}"; do
  OUT=$(curl -s -m 60 -X POST -H "Authorization: Bearer $AWS_BEARER_TOKEN_BEDROCK" -H "Content-Type: application/json" \
    "https://bedrock-runtime.$R.amazonaws.com/model/$M/converse" \
    -d '{"messages":[{"role":"user","content":[{"text":"Reply with just: ok"}]}],"inferenceConfig":{"maxTokens":20}}')
  if echo "$OUT" | grep -q '"output"'; then echo "OK    $M"; else echo "FAIL  $M  $(echo "$OUT" | head -c 120)"; fi
done
