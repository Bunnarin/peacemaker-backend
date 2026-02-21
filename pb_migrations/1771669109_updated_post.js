/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2106002237")

  // update collection data
  unmarshal({
    "listRule": "approved = true"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2106002237")

  // update collection data
  unmarshal({
    "listRule": "approved = true && stance.approved = true"
  }, collection)

  return app.save(collection)
})
