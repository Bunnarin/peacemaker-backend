/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1754858045")

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "bool3097791879",
    "name": "needVPN",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1754858045")

  // remove field
  collection.fields.removeById("bool3097791879")

  return app.save(collection)
})
