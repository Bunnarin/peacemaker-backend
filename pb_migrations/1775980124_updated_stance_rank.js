/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1978854890")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT stance as id, COUNT(*) AS COUNT\nFROM post\nWHERE stance != ''\nGROUP BY stance;"
  }, collection)

  // remove field
  collection.fields.removeById("number314755213")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "number1921877714",
    "max": null,
    "min": null,
    "name": "COUNT",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1978854890")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT stance as id, COUNT(*) AS post_count\nFROM post\nWHERE stance != ''\nGROUP BY stance;"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "number314755213",
    "max": null,
    "min": null,
    "name": "post_count",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // remove field
  collection.fields.removeById("number1921877714")

  return app.save(collection)
})
