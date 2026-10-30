-- Se ejecuta solo la primera vez que se crea el volumen de PostgreSQL.
-- aspar_test es la base que usa pytest: su esquema public se borra en cada ejecución.
create database aspar_test owner aspar;
