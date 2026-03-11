/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3052289650")

  // remove field
  collection.fields.removeById("text2200387651")

  // remove field
  collection.fields.removeById("text2338129802")

  // remove field
  collection.fields.removeById("text313633892")

  // remove field
  collection.fields.removeById("text449571757")

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "bool1306378733",
    "name": "obvious",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3052289650")

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2200387651",
    "max": 280,
    "min": 0,
    "name": "kh_kh_x",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2338129802",
    "max": 280,
    "min": 0,
    "name": "kh_th_x",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text313633892",
    "max": 280,
    "min": 0,
    "name": "th_kh_x",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text449571757",
    "max": 280,
    "min": 0,
    "name": "th_th_x",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("bool1306378733")

  return app.save(collection)
})
