/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1754858045")

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "select4258108440",
    "maxSelect": 2,
    "name": "audience",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "kh",
      "th"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1754858045")

  // remove field
  collection.fields.removeById("select4258108440")

  return app.save(collection)
})
