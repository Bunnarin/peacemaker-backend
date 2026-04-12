/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1978854890")

  // update collection data
  unmarshal({
    "name": "stance_frequency"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1978854890")

  // update collection data
  unmarshal({
    "name": "stance_rank"
  }, collection)

  return app.save(collection)
})
