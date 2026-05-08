LINTER_CONFIGS = https://gitlab.confirm.ch/confirm/dev-configs/-/raw/main/linter

#
# Cleanup
#

clean: clean-test clean-node

clean-test:
	rm -vrf eslint.config.mjs

clean-node:
	rm -vrf node_modules package-lock.json

#
# Install
#

install:
	npm install

develop: install

#
# Test
#

test-eslint:
	curl -sSfo eslint.config.mjs $(LINTER_CONFIGS)/eslint.config.mjs
	npx eslint $(BUILD_DIR)/assets/**/*.js

test: test-eslint

#
# Build
#

build:
	npm run build
