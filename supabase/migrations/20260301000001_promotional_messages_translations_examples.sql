-- Script para actualizar mensajes promocionales con traducciones a 4 idiomas
-- Ejecutar DESPUÉS de la migración add_promotional_translations.sql

-- Actualizar mensaje existente de Nodo Tecnológico con traducciones
UPDATE promotional_messages 
SET 
    message = '¿Sabías que en Nodo Tecnológico podés encontrar servicio técnico, reparación de PC, venta de equipos y más? ¡Visitanos en nuestra sucursal!',
    message_en = 'Did you know that at Nodo Tecnológico you can find technical service, PC repair, equipment sales and more? Visit us at our branch!',
    message_pt = 'Você sabia que na Nodo Tecnológico você pode encontrar serviço técnico, reparo de PC, venda de equipamentos e muito mais? Visite-nos em nossa filial!',
    message_fr = 'Saviez-vous qu'à Nodo Tecnológico vous pouvez trouver un service technique, une réparation de PC, la vente d'équipements et bien d'autres services ? Visitez-nous dans notre succursale !'
WHERE business_name = 'Nodo Tecnológico' AND message LIKE '%Sabías que en Nodo%';

-- Actualizar segundo mensaje de Nodo Tecnológico
UPDATE promotional_messages 
SET 
    message = 'Si necesitás reparar tu compu, comprar accesorios o asesoramiento técnico, Nodo Tecnológico es tu lugar. ¡Consultá por nuestros servicios!',
    message_en = 'If you need to repair your computer, buy accessories or technical advice, Nodo Tecnológico is your place. Check out our services!',
    message_pt = 'Se você precisa consertar seu computador, comprar acessórios ou aconselhamento técnico, Nodo Tecnológico é o seu lugar. Conheça nossos serviços!',
    message_fr = 'Si vous avez besoin de réparer votre ordinateur, d'acheter des accessoires ou de conseils techniques, Nodo Tecnológico est l'endroit qu'il vous faut. Découvrez nos services !'
WHERE business_name = 'Nodo Tecnológico' AND message LIKE '%Si necesitás reparar%';

-- Actualizar mensaje de Registro de Negocios (versión larga)
UPDATE promotional_messages 
SET 
    message = '¿Tenés un negocio que te gustaría que aparezca en la app como destacado? Te explico cómo registrarlo: 1) Entrá a ''Mi Negocio'' y completá la ficha con nombre, dirección, horario y contacto. 2) Subí varias fotos y el logo de tu establecimiento. 3) Adjuntá la documentación necesaria y solicitá la acreditación. 4) Nuestro equipo revisará la solicitud y, una vez aprobada, tu negocio podrá aparecer como ''Comercio Certificado'' y ser destacado en la app. ¿Querés que te lleve ahora al formulario?',
    message_en = 'Do you have a business that you would like to appear in the app as featured? I'll explain how to register it: 1) Go to ''My Business'' and fill out the form with name, address, hours and contact. 2) Upload several photos and your establishment's logo. 3) Attach the necessary documentation and request accreditation. 4) Our team will review the request and, once approved, your business can appear as ''Verified Business'' and be featured in the app. Want me to take you to the form now?',
    message_pt = 'Você tem um negócio que gostaria que aparecesse no app como destaque? Vou explicar como registrá-lo: 1) Vá para ''Meu Negócio'' e preencha o formulário com nome, endereço, horário e contato. 2) Carregue várias fotos e o logotipo do seu estabelecimento. 3) Anexe a documentação necessária e solicite a acreditação. 4) Nossa equipe analisará a solicitação e, uma vez aprovada, seu negócio poderá aparecer como ''Negócio Verificado'' e ser destaque no app. Quer que eu te leve ao formulário agora?',
    message_fr = 'Vous avez une entreprise que vous aimeriez voir apparaître dans l'application comme en vedette ? Je vais vous expliquer comment l'enregistrer : 1) Allez à ''Mon Entreprise'' et remplissez le formulaire avec le nom, l'adresse, les heures et les coordonnées. 2) Téléchargez plusieurs photos et le logo de votre établissement. 3) Joignez la documentation nécessaire et demandez l'accréditation. 4) Notre équipe examinera la demande et, une fois approuvée, votre entreprise peut apparaître comme ''Entreprise Vérifiée'' et être en vedette dans l'application. Voulez-vous que je vous mène au formulaire maintenant ?'
WHERE business_name = 'Registro de Negocios' AND message LIKE '%¿Tenés un negocio que te gustaría%';

-- Actualizar mensaje de Registro de Negocios (versión corta)
UPDATE promotional_messages 
SET 
    message = 'Si querés aparecer destacado en la app: abrí ''Mi Negocio'' → Crear ficha → subí fotos y un texto breve sobre lo que los hace únicos. En 48-72h el equipo revisa y te avisa. ¿Deseás que te muestre cómo?',
    message_en = 'If you want to stand out in the app: open ''My Business'' → Create profile → upload photos and a brief text about what makes you unique. In 48-72 hours our team reviews and lets you know. Would you like me to show you how?',
    message_pt = 'Se você quer se destacar no app: abra ''Meu Negócio'' → Criar perfil → carregue fotos e um texto breve sobre o que o torna único. Em 48-72 horas Nossa equipe analisa e informa. Quer que eu mostre como?',
    message_fr = 'Si vous voulez vous démarquer dans l'application : ouvrez ''Mon Entreprise'' → Créer un profil → téléchargez des photos et un bref texte sur ce qui vous rend unique. Dans 48 à 72 heures, notre équipe examine et vous informe. Voulez-vous que je vous montre comment ?'
WHERE business_name = 'Registro de Negocios' AND message LIKE '%Si querés aparecer destacado%';

-- Insertar nuevos mensajes promocionales multilingües como ejemplo de gastronomía
INSERT INTO promotional_messages (business_name, message, message_en, message_pt, message_fr, is_active, category, priority, show_probability)
VALUES 
(
    'Restaurantes Locales',
    '¿Tienes hambre? Te recomiendo visitar los mejores restaurantes de Santiago. Desde comida tradicional hasta opciones gourmet, ¡aquí encontrarás de todo!',
    'Hungry? I recommend visiting the best restaurants in Santiago. From traditional food to gourmet options, you''ll find everything here!',
    'Com fome? Recomendo visitar os melhores restaurantes de Santiago. De comida tradicional a opções gourmet, você encontrará de tudo por aqui!',
    'Vous avez faim ? Je vous recommande de visiter les meilleurs restaurants de Santiago. Des aliments traditionnels aux options gastronomiques, vous trouverez de tout ici !',
    true,
    'gastronomia',
    2,
    30
);

-- Insertar más ejemplos de mensajes para diferentes categorías
INSERT INTO promotional_messages (business_name, message, message_en, message_pt, message_fr, is_active, category, priority, show_probability)
VALUES 
(
    'Atractivos Naturales',
    'Santiago tiene algunos de los paisajes más hermosos de la región. ¿Quieres explorar reservas naturales, parques y miradores con vistas espectaculares?',
    'Santiago has some of the most beautiful landscapes in the region. Want to explore nature reserves, parks, and viewpoints with spectacular views?',
    'Santiago tem algumas das paisagens mais belas da região. Quer explorar reservas naturais, parques e mirantes com vistas espetaculares?',
    'Santiago a certains des plus beaux paysages de la région. Vous voulez explorer des réserves naturelles, des parcs et des points de vue avec des vues spectaculaires ?',
    true,
    'naturaleza',
    3,
    25
);

-- Ver todos los mensajes promocionales disponibles con sus traducciones
-- SELECT * FROM promotional_messages_translated;
