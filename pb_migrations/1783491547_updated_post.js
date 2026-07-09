/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2106002237")

  // update field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": true,
    "id": "json1213945262",
    "maxSize": 0,
    "name": "embedding",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2106002237")

  // update field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "json1213945262",
    "maxSize": 0,
    "name": "embedding",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
})
