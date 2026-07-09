/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2106002237")

  // update collection data
  unmarshal({
    "deleteRule": null
  }, collection)

  // add field
  collection.fields.addAt(17, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1095482667",
    "help": "",
    "hidden": false,
    "id": "relation2981797471",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "anti_stance",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2106002237")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.reviewer = true"
  }, collection)

  // remove field
  collection.fields.removeById("relation2981797471")

  return app.save(collection)
})
