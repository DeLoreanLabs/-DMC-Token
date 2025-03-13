#!/bin/bash

# A script to publish the smart contract under ../move/<dir name>
# On successful deployment, the script updates the env files setup/.env and app/.env
# The env files are updated with env variables to represent the newly created objects

# dir of smart contract
MOVE_PACKAGE_PATH="../move/dmc"
PUBLISH_GAS_BUDGET=900000000

# check this is being run from the right location
if [[ "$PWD" != *"/scripts" ]]; then
	echo "Please run this from ./scripts"
	exit 0
fi

# check dependencies are available
for dep in jq curl sui; do
	if !command -V ${i} 2>/dev/null; then
		echo "Please install lib ${dep}"
		exit 1
	fi
done

NETWORK_ALIAS=$(sui client active-env)
ENVS_JSON=$(sui client envs --json)
FULLNODE_URL=$(echo $ENVS_JSON | jq -r --arg alias $NETWORK_ALIAS '.[0][] | select(.alias == $alias).rpc')
ADDRESSES=$(sui client addresses --json)

echo "Checking if dmc-admin address is available"
HAS_ADMIN=$(echo "$ADDRESSES" | jq -r '.addresses | map(contains(["dmc-admin"])) | any')
if [ "$HAS_ADMIN" = "false" ]; then
	echo "Did not find 'dmc-admin' in the ADDRESSES. Creating one and requesting tokens."
	sui client new-address ed25519 dmc-admin
fi

echo "Switching to dmc-admin address"
sui client switch --address dmc-admin

echo "Checking if enough GAS is available for dmc-admin"
GAS=$(sui client gas --json)
AVAILABLE_GAS=$(echo "$GAS" | jq --argjson min_gas $PUBLISH_GAS_BUDGET '.[] | select(.mistBalance > $min_gas).gasCoinId')
if [ -z "$AVAILABLE_GAS" ]; then
	echo "Not enough GAS to deploy contract, requesting from faucet for all ADDRESSES"
	sui client faucet
	# If NETWORK_ALIAS is localnet wait 2 sec
	if [ "$NETWORK_ALIAS" == "localnet" ] || [ "$NETWORK_ALIAS" == "local" ]; then
		sleep 2
	else
		echo "Please try again after some time."
		exit 1
	fi
fi

WITH_UNPUBLISHED_DEPENDENCIES=""
if [ "$NETWORK_ALIAS" == "devnet" ] || [ "$NETWORK_ALIAS" == "local" ] || [ "$NETWORK_ALIAS" == "localnet" ]; then
	WITH_UNPUBLISHED_DEPENDENCIES="--with-unpublished-dependencies"
fi

# Do actual puslish
echo "Publishing"
PUBLISH_RES=$(sui client publish --skip-dependency-verification ${WITH_UNPUBLISHED_DEPENDENCIES} --json ${MOVE_PACKAGE_PATH})

echo "Writing publish result to .publish.res.json"
echo ${PUBLISH_RES} >.publish.res.json

# Check if the command succeeded (exit status 0) and for success in text
if [[ "$PUBLISH_RES" =~ "error" && "$PUBLISH_RES" != *"Success"* ]]; then
	# If yes, print the error message and exit the script
	echo "Error during move contract publishing. Details : $PUBLISH_RES"
	exit 1
fi

# Publish success
echo "Publish successful"
echo "Creating new env variables"
PUBLISH_OBJECTS=$(echo "$PUBLISH_RES" | jq -r '.objectChanges[] | select(.type == "published")')
PACKAGE_ID=$(echo "$PUBLISH_OBJECTS" | jq -r '.packageId')
CREATED_OBJS=$(echo "$PUBLISH_RES" | jq -r '.objectChanges[] | select(.type == "created")')
UPGRADECAP=$(echo "$CREATED_OBJS" | jq -r 'select (.objectType == "0x2::package::UpgradeCap").objectId')
ADMIN=$(sui client active-address)

EXPORT_RESP=$(sui keytool export --key-identity $ADMIN --json)
ADMIN_PRIVATE_KEY=$(echo "$EXPORT_RESP" | jq -r '.exportedPrivateKey')

echo "Publish new env var to scripts/.env: "
echo "FULLNODE_URL=$FULLNODE_URL"
echo "PACKAGE_ADDRESS=$PACKAGE_ID"
echo "ADMIN_ADDRESS=$ADMIN"

cat >.env <<-API_ENV
	FULLNODE_URL=$FULLNODE_URL
	PACKAGE_ID=$PACKAGE_ID
	UPGRADECAP=$UPGRADECAP
	ADMIN_PRIVATE_KEY=$ADMIN_PRIVATE_KEY
API_ENV

echo "Done - Proceed to run the setup scripts"
