SELECT id, name, length(name) AS len, encode(convert_to(name,'UTF8'),'hex') AS hex_bytes FROM departments ORDER BY name;
SELECT id, name, length(name) AS len, encode(convert_to(name,'UTF8'),'hex') AS hex_bytes FROM locations ORDER BY name;
