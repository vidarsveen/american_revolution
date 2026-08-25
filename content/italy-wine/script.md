// Kapittel 1: Piemonte. This is the chapter in the form a person writes it;
// chapter-1-piemonte.json is compiled from it and is what the engine loads.
// The two are kept in step by hand in exactly one way: `--check` tells you
// whether they still say the same thing, and `--from-json` brings this file
// back into line if the JSON was edited directly.
//
//     python tools/author.py content/italy-wine/script.md --check
//     python tools/author.py content/italy-wine/script.md --write
//     python tools/narrate.py --chapter italy-wine/chapter-1-piemonte --lang no
//
// The plain line is the Norwegian, written first; the `>` line under it is the
// English. A cue in {braces} fires on the word it sits directly after, and
// {^} marks that same word in the English when the two languages use a
// different one. A blank line between two sentences is a longer pause.
//
// docs/authoring.md writes a new chapter from nothing, start to finish.
// `python tools/author.py --verbs` lists every cue and what it takes.

---
id: chapter-1-piemonte
pack: italy-wine
title: Tåka og tørsten | The fog and the thirst
subtitle: Italia, og først Piemonte | Italy, and Piedmont first
regions: geo/regions.geojson
---

# places
torino  45.0703, 7.6869  zoom=9.0  kind=city  Torino | Turin
milano  45.4642, 9.19  zoom=9.0  kind=city  Milano | Milan
roma  41.9028, 12.4964  zoom=9.0  kind=city  Roma | Rome
napoli  40.8518, 14.2681  zoom=9.0  kind=city  Napoli | Naples
palermo  38.1157, 13.3615  zoom=9.0  kind=city  Palermo
firenze  43.7696, 11.2558  zoom=9.0  kind=city  Firenze | Florence
alba  44.7009, 8.0353  zoom=11.4  kind=town  Alba
barolo  44.61, 7.943  zoom=12.4  kind=town  Barolo
barbaresco  44.725, 8.084  zoom=12.4  kind=town  Barbaresco
asti  44.9009, 8.2064  zoom=10.6  kind=town  Asti
langhe  44.645, 8.01  zoom=11.0  kind=region  Langhe | The Langhe
etna  37.751, 14.9934  zoom=10.0  kind=hill  Etna
tunis  36.8065, 10.1815  zoom=8.0  kind=city  Tunis
capo-passero  36.685, 15.135  zoom=10.0  kind=town  Capo Passero

# ending
say: Én dal, én drue, og et navn som er et sted. Det er Italia i miniatyr. | One valley, one grape, and a name that is a place. That is Italy in miniature.
figure.value: 500
figure.label: druesorter i Italia | grape varieties in Italy

## Fem hundre druer | Five hundred grapes

{music bedWarm} {mood day} {flyTo roma zoom=4.9 over=3.4} Det finnes over fem {stat 500+ label=druesorter i Italia | grape varieties in Italy side=red} hundre druesorter i vanlig bruk i Italia. Frankrike {stat ~200 label=i Frankrike | in France side=neutral} har rundt to hundre. Spania færre enn det. {mark term:drue @word:druesorter} {plate druer-kasse motion=in over=20 dim=0.16 push=0.1 into=1.4 @start} {fact term:drue @word:druesorter}
> There are over five {^1} hundred grape varieties {^3} {^4} in commercial use in Italy. France {^2} has around two hundred. Spain fewer than that.
{stat.clear} De fleste av dem vokser ikke noe annet sted i verden. Ikke i Chile, ikke i California, ikke i Australia.
> Most of them grow nowhere else on earth. Not in Chile, not in California, not in Australia.

{plate.hide 1.1} Grunnen er verken klima eller flaks. Grunnen er at Italia ble ett land veldig seint, og at det er fullt av fjell. {mark topic:hvorfor-italia span=1} {plate dal-avstengt motion=in over=20 dim=0.14 push=0.2 into=1.4 @start}
> The reason is neither climate nor luck. The reason is that Italy became one country very late, and that it is full of mountains. {^}
{plate.hide 1.1 @end} {flyTo torino zoom=6.4 over=4.0} {note Piemonte, nordvest i Italia | Piedmont, north-west Italy @end} Dette er første del av en reise nedover støvelen. Vi begynner helt nordvest, i tåka.
> This is the first part of a journey down the boot. We start in the far north-west, in the fog.

## Et land som står på høykant | A country stood on its edge

{music bedPatient} {flyTo roma zoom=4.8 over=3.6} {region.clear} Se på formen først. Italia er tolv hundre kilometer langt, og det gjør nesten alt mulig.
> Look at the shape first. Italy is twelve hundred kilometres long, and that makes almost anything possible.
I nord ligger Alpene, med snø hele året. Sør på Sicilia {marker capo-passero label=Sicilias sørspiss | The southern tip of Sicily kind=point tone=gold} er du lenger sør enn Tunis {marker tunis kind=point tone=sage} i Nord-Afrika.
> In the north lie the Alps, under snow all year. In the south of Sicily {^} you are further south than Tunis {^} in North Africa.

{marker.clear} {flyTo firenze zoom=5.6 over=3.4} {plate alpene-over motion=out over=22 dim=0.12 push=0.22 into=1.4} Men lengden er ikke det viktigste. Det viktigste er at bare en firedel av landet er flatt.
> But the length is not the main thing. The main thing is that only a quarter of the country is flat.
Resten er fjell og åser. Og høyde gir kalde netter, selv der dagene er brennhete.
> The rest is mountain and hill. And altitude gives cold nights, even where the days are fierce.
Kalde netter er alt for en drue. Sola bygger sukker om dagen, og kulda om natta holder på syren {mark term:terroir} og lukten. {flyTo etna zoom=8.6 over=4.5 @start}
> Cold nights are everything for a grape. The sun builds sugar in the day, and the cold at night holds on to the acid {^} and the smell.
{plate.hide 1.2} Uten den kulda blir vinen slapp. Det er derfor Etna {marker etna kind=point tone=red} på Sicilia, ni hundre meter opp på en vulkan, lager friskere vin enn markene nede ved kysten.
> Without that cold the wine goes flabby. It is why Etna {^} in Sicily, nine hundred metres up a volcano, makes fresher wine than the fields down at the coast.
{marker.clear} {flyTo roma zoom=4.8 over=5.0} Og fjellene gjorde en ting til. De holdt folk fra hverandre i tusen år.
> And the mountains did one more thing. They kept people apart for a thousand years.

## Hver dal sin drue | Every valley its own grape

{ambience vineyard gainDb=-15} {mood day} {flyTo firenze zoom=5.2 over=3.8} Italia ble ett land i attensekstien. Før det var det kongedømmer, hertugdømmer og bystater som knapt handlet med hverandre.
> Italy became one country in 1861. Before that it was kingdoms, duchies and city states that barely traded with each other.

{plate gammel-stokk motion=in over=18 dim=0.16 push=0.08 into=1.4} En bonde i en dal plantet det som vokste i den dalen. Naboen over fjellet plantet noe annet.
> A farmer in one valley planted what grew in that valley. His neighbour over the mountain planted something else.
Ingen av dem byttet stiklinger, fordi det var to dagsreiser med muldyr imellom. Så begge beholdt sitt.
> Neither of them swapped cuttings, because it was two days by mule between them. So both kept their own.
{plate.hide 1.1} Gjenta det i tusen år, i et land med fjell overalt, og du sitter igjen med fem {stat 500+ label=druesorter | grape varieties side=red} hundre druer.
> Repeat that for a thousand years, in a country with mountains everywhere, and you end up with five {^} hundred grapes.
{stat.clear} Nesten hver region har minst én drue som er dens egen. Toscana {region Toscana side=red label=true over=1.4} har Sangiovese.
> Almost every region has at least one grape that is its own. Tuscany {^} has Sangiovese.
Veneto {region Veneto side=red label=true over=1.4} har Corvina, og lager Amarone av den. Campania {region Campania side=red label=true over=1.4} har Aglianico, som romerne allerede drakk.
> Veneto {^} has Corvina, and makes Amarone from it. Campania {^} has Aglianico, which the Romans were already drinking.
Og Piemonte, {region Piemonte side=red label=true over=1.6} helt nordvest, har Nebbiolo. {mark term:nebbiolo} {fact grape:nebbiolo} Det er den vi skal se på i dag.
> And Piedmont, {^1} in the far north-west, has Nebbiolo. {^2} {^3} That is the one we are looking at today.
{region.clear} En ting til, før vi drar. Navnet på en italiensk flaske {mark topic:lese-etiketten span=1} er nesten alltid et sted, ikke en drue.
> One more thing before we go. The name on an Italian bottle {^} is nearly always a place, not a grape.
Barolo er et sted. Chianti er et sted. Druen står det sjelden noe om, fordi alle på stedet vet hvilken det er.
> Barolo is a place. Chianti is a place. The grape often goes unmentioned, because everyone there knows which one it is.

## Tåka | The fog

{music bedMist} {mood dawn} {flyTo torino zoom=7.6 over=1.6} Piemonte {region Piemonte side=red label=true over=1.6} betyr ved foten av fjellet. Alpene ligger rundt det på tre kanter, som en skål.
> Piemonte {^} means at the foot of the mountain. The Alps stand around it on three sides, like a bowl.

{plate langhe-take motion=in over=22 dim=0.1 push=0.18 into=1.4} Om høsten fylles den skåla med tåke. Den ligger i dalbunnen om morgenen og brenner av utover dagen.
> In autumn that bowl fills with fog. It lies in the valley floors in the morning and burns off through the day.
Nebbia, heter det på italiensk. Og derfra har druen navnet sitt. {mark term:nebbiolo @word:nebbia}
> Nebbia, {^} it is called in Italian. And that is where the grape gets its name.

{plate.hide 1.1} {plate hender-host motion=in over=18 dim=0.14 push=0.1 into=1.4} Enten fordi den modnes så seint at den henger igjen til oktober, når dalen står full om morgenen. Eller fordi skallet har et grått belegg som ligner.
> Either because it ripens so late that it hangs on into October, when the valley is full of it every morning. Or because the skins carry a grey bloom that looks like it.
Ingen av forklaringene kan bevises. Men begge sier det samme om druen: den blir hengende lenge etter at alt annet er plukket.
> Neither explanation can be proved. But both say the same thing about the grape: it hangs on long after everything else has been picked.
{plate.hide 1.1} {region.clear} Sør for Torino ligger elva Tanaro, og sør for elva reiser bakkene {fitPlaces alba,barolo,barbaresco over=3.0} seg. De heter Langhe. {mark term:langhe}
> South of Turin runs the river Tanaro, and south of the river the hills {^} rise. They are called the Langhe. {^}

## En drue som ikke vil flytte | A grape that will not move

{music bedPatient} {mood day} {fitPlaces alba,barolo,barbaresco over=3.4} {plate glass-blek-rod motion=in over=18 dim=0.14 push=0.07 into=1.4} Nebbiolo er en mørk drue som lager en påfallende blek vin. Etter noen år i flaska er den nesten oransje i kanten.
> Nebbiolo is a dark grape that makes a strikingly pale wine. After a few years in the bottle it is almost orange at the rim.
Den ser altså tynn ut, og er samtidig blant de mest tanninrike {mark term:tannin} {fact term:tannin} vinene som lages noe sted.
> So it looks thin, and is at the same time among the most tannic {^1} {^2} wines made anywhere.
{plate.hide 1.1} Tanniner er stoffer fra skallet og stilkene. De binder seg til spyttet ditt, og munnen føles tørr. Samme følelse som sterk svart te.
> Tannins come from the skins and the stems. They bind to your saliva, and your mouth feels dry. The same sensation as strong black tea.
Det er også derfor vinen tåler å ligge. En ung Barolo er nesten ubehagelig. Den samme flaska etter tjue {stat 20+ label=år den kan lagres | years it will keep side=red} år er noe helt annet. {play corkDraw gainDb=-8 @word:flaska}
> It is also why the wine can be kept. A young Barolo is nearly unpleasant. The same bottle {^2} at twenty {^1} years is a different thing entirely.

{stat.clear} {plate vinmark-helling motion=left over=22 dim=0.12 push=0.18 into=1.4} Og så er den håpløst kresen. Nebbiolo krever kalkrik leire, sørvendt helling og en lang høst.
> And then it is hopelessly fussy. Nebbiolo demands chalky clay, a south-facing slope and a long autumn.
Folk har prøvd å dyrke den i California, i Australia og i Argentina i over hundre år. Det blir aldri riktig.
> People have tried to grow it in California, Australia and Argentina for over a hundred years. It never comes out right.
{plate.hide 1.1 @end} Nesten all Nebbiolo i verden vokser innenfor noen få mil her. Det er den beste illustrasjonen jeg kjenner på hva terroir {mark term:terroir} betyr. {note Langhe, sør for Alba | The Langhe, south of Alba @end}
> Almost all the Nebbiolo in the world grows within a few dozen kilometres of here. It is the best illustration I know of what terroir {^} means.

## To landsbyer | Two villages

{music bedHollow} {fitPlaces barolo,barbaresco over=3.8} Nebbiolo lager to berømte viner, og de er oppkalt etter to landsbyer som ligger atten kilometer fra hverandre.
> Nebbiolo makes two famous wines, and they are named after two villages eighteen kilometres apart.
Barolo {marker barolo label=Barolo kind=point tone=red} ligger sørvest for Alba. Barbaresco {marker barbaresco label=Barbaresco kind=point tone=gold} ligger nordøst. Samme drue, samme fylke, to forskjellige {chart wine:barolo kind=profile against=wine:barbaresco note=Samme drue, atten kilometer fra hverandre. | The same grape, eighteen kilometres apart.} viner.
> Barolo {^} lies south-west of Alba. Barbaresco {^} lies north-east. Same grape, same county, two different {^} wines.
Barbaresco ligger litt lavere og litt nærmere elva. Det gir varmere netter, og druene modner noen dager tidligere.
> Barbaresco sits a little lower and a little nearer the river. That gives warmer nights, and the grapes ripen a few days earlier.
Noen få dager høres ingenting ut. I praksis er det forskjellen {fact wine:barbaresco} på en vin du kan drikke etter fem år og en du bør vente ti på.
> A few days sounds like nothing. In practice it is the difference {^} between a wine you can drink at five years and one you should wait ten for.

{chart.hide} {ambience cellar gainDb=-15} Barolo må ligge minst trettiåtte {compare part=38 "38 mnd" red Barolo part=26 "26 mnd" sweet Barbaresco mode=bar note=Minste lagringstid før salg. | Minimum ageing before sale.} {mark topic:hva-koster span=1} måneder før den selges. Minst atten av dem på trefat. {plate kjeller-fat motion=in over=18 dim=0.18 push=0.14 into=1.4 @start}
> Barolo must be held at least thirty-eight {^1} {^2} months before sale. At least eighteen of them in wood.
Det er over tre år der vinen koster penger og ikke tjener noen. Mye av prisen på flaska er den ventinga.
> That is over three years in which the wine costs money and earns nobody anything. Much of the price on the bottle is that wait.

{plate.hide 1.1} {compare.clear} {plate flasker-liggende motion=in over=16 dim=0.16 push=0.1 into=1.4} Resten av prisen ligger i bakken. En teig i Cannubi koster mer enn en lik teig to kilometer unna, fordi den har gitt bedre vin i to hundre år.
> The rest of the price is in the hillside. A plot in Cannubi costs more than an identical plot two kilometres away, because it has given better wine for two hundred years.
{plate.hide 1.1 @end} {marker.clear} Hele det italienske systemet {mark term:docg} bygger på at det er sant. At stedet smakes. {fact term:docg @start}
> The whole Italian system {^} rests on that being true. That the place can be tasted.

## Det de faktisk drikker | What they actually drink

{music bedLilt} {mood dusk} {fitPlaces asti,alba,torino over=4.0} Men nesten ingen i Piemonte drikker Barolo til hverdags. Det er dyrt, og det er tungt.
> But hardly anyone in Piedmont drinks Barolo on a weekday. It is expensive, and it is heavy.

Til middag drikker de Barbera. {mark term:barbera} Mørk farge, høy syre, nesten ingen tannin. Den er lett å like fra første slurk. {plate bord-middag motion=in over=20 dim=0.16 push=0.09 into=1.4 @start} {fact grape:barbera @word:Barbera} {play pour gainDb=-8 @word:Barbera}
> With dinner they drink Barbera. {^1} {^2} {^3} Dark colour, high acid, almost no tannin. It is easy to like from the first mouthful.
Barbera fikk historisk de markene Nebbiolo ikke ville ha. Den modner tidligere og klager mindre.
> Barbera historically got the sites Nebbiolo would not take. It ripens earlier and complains less.
Derfor ble den regnet som bondevin i lang tid. Det endret seg på nittenåttitallet, da noen begynte å ta den alvorlig.
> So it was thought of as peasant wine for a long time. That changed in the 1980s, when some producers began taking it seriously.
{plate.hide 1.1} Og nord for Alba, rundt Asti, {marker asti label=Asti kind=point tone=gold} lager de noe helt annet igjen. Moscato. {mark term:moscato} {fact grape:moscato}
> And north of Alba, around Asti, {^1} they make something else altogether. Moscato. {^2} {^3}

{plate glass-perler motion=in over=18 dim=0.14 push=0.07 into=1.4} Gjæringen stanses midtveis ved å kjøle vinen ned. Halvparten av sukkeret blir igjen, og boblene som alt er dannet blir sittende.
> The fermentation is stopped halfway by chilling the wine. Half the sugar stays, and the bubbles already formed stay with it.
Resultatet er søtt, lett perlende og bare rundt fem {compare part=145 "14,5 %" red Barolo part=50 "5 %" sweet Moscato d’Asti mode=bar note=Typisk alkoholstyrke. | Typical alcoholic strength.} prosent alkohol. En tredel av en Barolo. {play fizz gainDb=-8 @word:perlende}
> The result is sweet, lightly fizzing {^2} and only about five {^1} per cent alcohol. A third of a Barolo.
{plate.hide 1.1} {compare.clear} {marker.clear} Én region. Én av tjue. {flyTo roma zoom=4.8 over=4.4} Tre helt forskjellige viner, og vi har ikke nevnt de hvite ennå.
> One region. One of twenty. {^} Three completely different wines, and we have not mentioned the whites yet.
Neste gang drar vi sørover, til Toscana, og til druen som lager Chianti.
> Next time we go south, to Tuscany, and to the grape that makes Chianti.
