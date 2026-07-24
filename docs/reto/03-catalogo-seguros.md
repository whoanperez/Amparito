# Catálogo de seguros Colsubsidio (oferta REAL)

> Datos **reales** extraídos de https://www.colsubsidio.com/seguros (sitio Next.js + Drupal headless;
> contenido obtenido del `__NEXT_DATA__` server-side, no del shell). Incluye **coberturas reales**,
> **aseguradoras aliadas** y **precios "desde" reales** donde el sitio los publica.
> Mapeado a las **5 categorías oficiales del reto**: Mascotas · Hogar · Crédito · Movilidad · Personal
> y Familiar.

## Hallazgo clave para el pitch: el sitio web actual TAMBIÉN depende del asesor

En **cada** producto, el "flujo de compra" del sitio termina así:
1. Eliges plan → **"Cotiza"** → ingresas tus datos personales →
2. **"Uno de nuestros asesores se pondrá en contacto contigo"** / *"Te llamaremos"* →
3. Pagas por los **canales autorizados por la aseguradora** (o con **cupo de crédito de la tarjeta de
   afiliación** / **cuota monetaria**).

> Es decir: **ni siquiera el canal digital actual cierra la venta solo** — recolecta un lead y lo pasa
> a un asesor. Ese es exactamente el cuello de botella que el reto quiere eliminar. Gran gancho para el
> pitch: *"hoy, la web de seguros de Colsubsidio termina en 'te llamaremos'."*

## Aseguradoras aliadas (Colsubsidio = sponsor/canal, no asegurador)

| Producto | Aseguradora(s) aliada(s) |
|---|---|
| Carro, Moto | **Seguros Bolívar** |
| SOAT | **Seguros Mundial** |
| Mascotas (seguro/asistencia) | **Sura, HDI, Seguros Mundial** |
| Accidentes personales | **Chubb, MetLife** |
| Vida | **Pan American Life** |
| Vida y Ahorro | **MetLife** |
| Exequial / funerario | **Grupo Recordar** |
| Asistencias múltiples | **GEA** |

## Catálogo por categoría oficial (con coberturas y precios reales)

### 1. Personal y Familiar
- **Seguro de Vida** — *Pan American, desde **$12.000/mes***. Estabilidad financiera ante
  fallecimiento, incapacidad o enfermedad. `/seguros/familiares/vida`
- **Seguro Exequial / Funerario** — *Grupo Recordar, planes mensuales desde **$26.000***. Cubre
  servicios de funeraria, destino final, cremación o inhumación, traslado a residencia habitual y
  **extensión de cobertura a mascotas**. Cubre al asegurado y a **cualquier miembro del grupo
  familiar**. `/seguros/personal/vida-exequial/funerario` · `/seguros/familiares/exequial`
- **Vida y Ahorro** — *MetLife, desde **$20.000/mes***. Protege ante fallecimiento accidental **e
  incrementa capital/ahorro automáticamente**. `/seguros/personal/vida-exequial/vida-ahorro`
- **Accidentes Personales** — *Chubb / MetLife*. Cobertura ante accidentes; existe variante
  **accidentes + servicio exequial**. `/seguros/personal/accidentes/{chubb|metlife}`
- **Póliza de Salud** — atención médica preferencial en red exclusiva de clínicas y especialistas.
- **Asistencias médicas familiares** — médico en casa, consultas telefónicas, urgencias dentales.
- **Asistencia médica en viajes** — consultas telefónicas, urgencias dentales, medicamentos.
- **Asesorías jurídicas** — trámites legales y consultas con expertos.

### 2. Mascotas (perro y gato)
Aseguradoras: **Sura, HDI, Seguros Mundial**. `/seguros/mascotas`
- **Seguro para mascotas** — Responsabilidad civil (daño a terceros), **fallecimiento por cualquier
  causa**, accidentes.
- **Asistencias para mascotas** — consulta veterinaria a domicilio, clínicas por urgencia, orientación
  veterinaria telefónica.
- **Medicina prepagada para mascotas** — consultas veterinarias, exámenes diagnósticos,
  hospitalizaciones y procedimientos quirúrgicos; reembolso para urgencias; servicios complementarios
  (guardería, chip, peluquería, adiestramiento).

### 3. Hogar
`/seguros/hogar`
- **Seguro para el hogar y su contenido** — estructura, electrodomésticos, muebles y bienes; coberturas
  clave como **terremoto** y daños imprevistos; robos.
- **Seguro de arrendamiento** — para quien alquila su propiedad: respaldo ante **impagos** del canon,
  **administración y servicios públicos**, honorarios legales y situaciones inesperadas.

### 4. Movilidad (vehículos)
`/seguros/vehiculos`. Cubre carro, moto, bici y patineta eléctrica; gastos de reparación en talleres,
asistencia (grúa, reemplazo de llaves, conductor elegido), robo, daños y accidentes.
- **Seguro para carros** — *Seguros Bolívar*. Daños a terceros incluidos.
- **Seguro para motos** — *Seguros Bolívar*. Robo total, accidentes, daños a terceros, grúa, llaves de
  repuesto.
- **Seguro para bicicleta y patineta** — protección contra robos y daños totales, **apoyo legal
  incluido**. (Precios vistos en cotizador: **$10.000** y suma **$500.000**.)
- **SOAT** — *Seguros Mundial*. Obligatorio; activación al instante; cubre lesiones y daños materiales
  en accidentes de tránsito.

### 5. Crédito (deudores financieros)
`/seguros/deudores-financieros`. Seguros incluidos en los créditos con Colsubsidio.
- **Seguro de vida deudor** — respalda los pagos ante **fallecimiento o incapacidad permanente**.
- **Seguro de desempleo** — respalda las cuotas ante **desempleo o incapacidad temporal**.
- **Seguro de incendio** — preserva el inmueble contra incendios y sucesos inesperados.

### Transversal
- **Asistencias Múltiples** — *GEA, planes mensuales desde **$20.000***, 24/7 nacional: médico a
  domicilio, ambulancia terrestre, plomería, cerrajería, grúa, auxilio vial, consulta veterinaria
  telefónica, refuerzo de vacunación. `/seguros/personal/asistencias-multiples`

## Notas sobre precios

- Los **"desde $X/mes"** son reales y publicados (Vida $12k, Vida y Ahorro $20k, Exequial $26k,
  Asistencias $20k). Sirven de **ancla realista** para el cotizador del MVP.
- El **precio final es variable** (edad, suma, vehículo…). El cotizador de exequial usa **tablas de
  factores por edad** (se observaron matrices de tasas en la página de cotización). → para el MVP:
  **tabla de tarifas basada en los "desde" reales + un factor por edad/suma**; realista y auditable,
  sin inventar cifras.

## Mapa perfil → producto (para la lógica de propensión)

> Variables reales de la base ([`02-datos-afiliados.md`](./02-datos-afiliados.md)). Formalizar como
> **matriz determinística y explicable** ("lógica documentada, no caja negra").

| Señal del perfil | Producto sugerido | Justificación (para el jurado) |
|---|---|---|
| Monoparental / Nuclear / Pareja; 36–55 años | **Vida** (Pan American) | Hay dependientes que protegerían un ingreso |
| Con hijos / dependientes | **Vida y Ahorro** (MetLife) | Proteger su futuro + construir ahorro |
| "Mayor de 55" o consumo Droguería | **Exequial** (Grupo Recordar) | Cobertura funeraria, prima baja, cubre familia |
| Joven urbano, sin grupo familiar, cat. A/B | **Movilidad bici/patineta**, **Mascotas** | Menos dependientes; activos propios |
| Ciudad + categoría/pirámide alta | **Hogar**, **Movilidad carro** (Bolívar) | Patrimonio y vehículo que proteger |
| Marca `AGENCIAS`=SI | **Asistencia médica en viajes** | Señal de consumo de viajes |
| Marca `PISCILAGO`=SI | **Personal y Familiar**, **Mascotas** | Perfil familiar/recreativo |
| Tiene crédito / obligaciones | **Deudores** (vida deudor, desempleo) | Respaldar la capacidad de pago |

**Recordatorio:** el 90% de afiliados no tiene marcas de consumo → el mapa se apoya en
**edad + segmento familiar + categoría + pirámide + ciudad**; el consumo solo **refuerza**.

## Recomendación de productos para el demo
> **Alcance confirmado: el sistema soporta TODAS las líneas** (ver
> [`01-requerimiento.md` §5.1](./01-requerimiento.md)); el jurado puede pedir **cualquier** seguro del
> catálogo. Lo de abajo es solo el **guion** para lucir la "variación por perfil" (20%), no un recorte
> de alcance.

Para el guion, apoyarse en **3 productos muy contrastantes**: **Vida/Exequial** (familiar, mayor) ·
**Movilidad bici/patineta** (joven urbano) · **Mascotas** (sin hijos). Cubren perfiles opuestos de la
base y tienen precios "desde" reales. **Pero el flujo, la cotización y las coberturas deben estar
listos para el resto del catálogo también**, porque el jurado puede salirse del guion.

## Pendientes menores
- [ ] Tablas de tarifa completas por edad/suma (parcialmente visibles en cotizadores; se aproximan).
- [ ] Coberturas al detalle de salud y accidentes (Chubb/MetLife) si se quieren en el demo.
