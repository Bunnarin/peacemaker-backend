/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2106002237")

  // remove field
  collection.fields.removeById("autodate3844849096")

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "date3556999320",
    "max": "",
    "min": "",
    "name": "publishedOn",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2106002237")

  // add field
  collection.fields.addAt(15, new Field({
    "hidden": false,
    "id": "autodate3844849096",
    "name": "createdOn",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // remove field
  collection.fields.removeById("date3556999320")

  return app.save(collection)
})
