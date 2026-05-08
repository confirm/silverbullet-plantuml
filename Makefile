#
# Cleanup
#

clean:
	rm -vrf node_modules package-lock.json

#
# Install
#

install:
	npm install

develop: install

#
# Build
#

bump-version:
	npm version --no-git-tag-version minor
	@VERSION=$$(node -p "require('./package.json').version") && \
		sed -i.bak "s/^version: .*/version: $$VERSION/" PLUG.md && \
		rm PLUG.md.bak && \
		echo "Bumped to $$VERSION"

plug-js:
	npm run build

build: plug-js bump-version
