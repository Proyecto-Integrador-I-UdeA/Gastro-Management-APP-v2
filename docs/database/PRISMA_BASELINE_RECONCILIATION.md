# Reconciliación de la baseline canónica de Prisma

## Propósito

Este documento registra la sustitución del historial activo legado por una baseline canónica capaz de reconstruir el esquema estructural aprobado de GastroManagement desde una base PostgreSQL completamente vacía.

La reconciliación parte del commit `22aba1795b708b2b47a0193bc2ad9eb064c0c62d` y utiliza como referencia física verificada la restauración local inmutable `gastro_management_restore_check`. El commit `48a80a5` se consultó únicamente para confirmar la definición Prisma de `VariableCosts` y `CostCategory`.

## Motivo del squash

La base física de referencia no contiene `public."_prisma_migrations"` y las 19 migraciones históricas del repositorio no reconstruyen el esquema físico actual. Entre las divergencias conocidas se encontraban:

- ausencia de migraciones para `MenuItem` y `MenuItemComponent`;
- ausencia de una migración completa para `RecipeItem.subRecipeId` y la nullability de `RecipeItem.productId`;
- eliminación histórica de `Product.currentStock` sin una migración posterior que lo restaurara;
- conversión histórica de `Product.unitOfMeasure` a `TEXT` aunque el esquema canónico utiliza `ProductBaseUnit`;
- incorporación física de `variable_costs` y `cost_categories` sin migración versionada.

Corregir retrospectivamente cada migración habría creado una historia distinta de la realmente desplegada. Por ello, las migraciones antiguas se retiran del directorio activo y se sustituyen por `00000000000000_canonical_baseline`.

## Migraciones históricas retiradas

Git conserva íntegramente el contenido anterior de estos directorios:

1. `20260305144958_init`
2. `20260305152209_make_role_id_and_relation_optional`
3. `20260305153128_make_role_id_required_again`
4. `20260308163927_create_supplier_product`
5. `20260309034353_add_active_to_user`
6. `20260319120000_add_product_category`
7. `20260326123000_add_active_to_suppliers_products`
8. `20260326160000_product_unit_base_enum`
9. `20260326172000_add_product_input_unit_fields`
10. `20260330130000_kardex_inventory`
11. `20260330150000_audit_timestamps`
12. `20260330160000_products_text_columns`
13. `20260330174116_add_recipes_module`
14. `20260330190000_drop_inventory_movement_unit_cost`
15. `20260330200000_unit_cost_on_movements_only`
16. `20260330210000_warehouse_is_main`
17. `20260330230000_product_unit_cost_reference`
18. `20260330240000_recipe_schema_align`
19. `20260330250000_costs_config_other_costs`

Estas migraciones no deben copiarse de nuevo al directorio activo, ejecutarse en instalaciones nuevas ni marcarse como aplicadas en bases existentes.

## Target canónico

La baseline representa únicamente estructura. El resultado esperado contiene 20 tablas:

1. `suppliers`
2. `IngredientCatalog`
3. `products`
4. `warehouses`
5. `inventories`
6. `inventory_movements`
7. `users`
8. `roles`
9. `permissions`
10. `role_permissions`
11. `recipes`
12. `recipe_items`
13. `recipe_processes`
14. `costs`
15. `config`
16. `other_costs`
17. `variable_costs`
18. `cost_categories`
19. `MenuItem`
20. `MenuItemComponent`

`VariableCosts` y `CostCategory` forman parte del target estructural porque las tablas físicas ya existen y pertenecen a la arquitectura Cost aprobada. Su inclusión no integra todavía controllers, routes ni UI del commit Cost.

## Elementos excluidos

La baseline no contiene:

- datos de negocio;
- seed o fixtures;
- usuarios, roles o permisos como filas;
- la fila histórica de `variable_costs`;
- IDs o timestamps existentes;
- valores actuales de sequences;
- owners o ACL;
- credenciales;
- una creación manual de `_prisma_migrations`.

`Product.currentStock` se conserva temporalmente porque forma parte del target físico actual. Cualquier deprecación futura deberá realizarse mediante una migración forward.

## Uso en bases nuevas

Una base PostgreSQL vacía debe construirse exclusivamente con las migraciones versionadas:

```text
prisma migrate deploy
```

No se debe usar `prisma db push` como mecanismo de despliegue o reconciliación de producción.

## Adopción futura por bases existentes

Una base existente que ya contiene el target canónico no debe ejecutar el SQL de la baseline. Después de validar backup, recuperabilidad y equivalencia estructural, la adopción conceptual es:

```text
prisma migrate resolve --applied 00000000000000_canonical_baseline
```

Solo se marca la baseline; las 19 migraciones históricas no se marcan como aplicadas.

Antes y después de `resolve` deben verificarse el checksum, `_prisma_migrations`, los conteos de datos y la ausencia de cambios físicos. Ante cualquier drift, solicitud de reset o SQL destructivo, el proceso debe detenerse.

## Estado de Railway

DB-BASELINE-02 no ejecuta ninguna operación contra Railway. En particular, todavía no se ha ejecutado:

- `prisma migrate resolve`;
- `prisma migrate deploy`;
- `prisma db push`;
- DDL o DML;
- cambio de startup;
- deploy.

La adopción, el retiro de `db push --accept-data-loss` y el cambio a `prisma migrate deploy` pertenecen a DB-BASELINE-02R, después de revisar y aprobar la validación local completa.
