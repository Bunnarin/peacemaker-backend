/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1754858045")

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "number2702878825",
    "max": null,
    "min": null,
    "name": "engagement_score",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1754858045")

  // remove field
  collection.fields.removeById("number2702878825")

  return app.save(collection)
})
