# Adding Images

Admin workflow for adding new images to MongoStage.

> Stub — filled out in Wave 5.

## Steps

1. Build the Dockerfile in `dockerfiles/`
2. Push to Docker Hub under `timatmongodb/mongostage:<tag>`
3. Update `images.json` with the new entry
4. Bump the version in `package.json`
5. Publish: `npm publish`
