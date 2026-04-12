/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1978854890")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT stance as id, COUNT(*) AS post_count\nFROM post\nWHERE stance != ''\nGROUP BY stance;"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1978854890")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT \n    stance as id, \n    COUNT(*) AS post_count\nFROM \n    post\nGROUP BY \n    stance;"
  }, collection)

  return app.save(collection)
})
