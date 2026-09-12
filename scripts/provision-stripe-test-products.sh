#!/usr/bin/env bash
set -euo pipefail

: "${STRIPE_SECRET_KEY:?STRIPE_SECRET_KEY is required}"
case "$STRIPE_SECRET_KEY" in
  sk_test_*) ;;
  *) echo "Refusing to provision products with a non-test Stripe key" >&2; exit 1 ;;
esac

create_product() {
  local key="$1" name="$2" description="$3" amount="$4"
  local product
  product=$(curl -fsS https://api.stripe.com/v1/products \
    -u "$STRIPE_SECRET_KEY:" \
    --data-urlencode "name=$name" \
    --data-urlencode "description=$description" \
    --data-urlencode "metadata[lottoops_plan_key]=$key")
  local product_id
  product_id=$(jq -r '.id' <<<"$product")
  local price
  price=$(curl -fsS https://api.stripe.com/v1/prices \
    -u "$STRIPE_SECRET_KEY:" \
    --data-urlencode "product=$product_id" \
    --data-urlencode "unit_amount=$amount" \
    --data-urlencode "currency=usd" \
    --data-urlencode "recurring[interval]=month" \
    --data-urlencode "metadata[lottoops_plan_key]=$key")
  jq -n --arg key "$key" --arg product "$product_id" --arg price "$(jq -r '.id' <<<"$price")" '{key:$key,product:$product,price:$price}'
}

create_product CORE CORE 'Core single-store receiving, inventory, shifts, and standard reports.' 3999
create_product CONTROL CONTROL 'Live ticket control, exceptions, protected corrections, and accountability.' 7900
create_product COMMAND COMMAND 'Multi-store oversight, customer display, and advanced operational visibility.' 7999
