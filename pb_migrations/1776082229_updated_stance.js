/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3052289650")

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "select1430541175",
    "maxSelect": 1,
    "name": "exclusive_origin",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "kh",
      "th"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3052289650")

  // remove field
  collection.fields.removeById("select1430541175")

  return app.save(collection)
})
