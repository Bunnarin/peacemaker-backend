/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1095482667")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.reviewer = true",
    "listRule": "",
    "updateRule": "@request.auth.reviewer = true"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1095482667")

  // update collection data
  unmarshal({
    "createRule": null,
    "listRule": null,
    "updateRule": null
  }, collection)

  return app.save(collection)
})
