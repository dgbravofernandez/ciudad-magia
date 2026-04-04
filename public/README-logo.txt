Para mostrar el escudo del club en la app:
1. Guarda el logo del CDG como: public/logo-cdg.png
2. Ejecuta este SQL en Supabase:
   UPDATE clubs SET logo_url = '/logo-cdg.png', name = 'E.F. Ciudad de Getafe', primary_color = '#F5C400', secondary_color = '#000000' WHERE slug = 'ciudad-magia';
   UPDATE club_settings SET gmail_from_address = 'info@efciudaddegetafe.com' WHERE club_id = (SELECT id FROM clubs WHERE slug = 'ciudad-magia');
