// chapter-6-kveik, skrevet som prosa. Kapittel-JSON kompileres fra denne fila
// og er det motoren laster; --check sier om de to fortsatt sier det samme.
//
//     python tools/author.py content/beer/script.chapter-6-kveik.md --check
//     python tools/author.py content/beer/script.chapter-6-kveik.md --write
//     python tools/narrate.py --chapter beer/chapter-6-kveik --lang no
//
// SISTE KAPITTEL, og det har to jobber. Det skal fortelle om kveik, og det
// skal lukke sirkelen kurset åpnet: fire ting i et glass, tre du kan veie og
// én som lever. Siste scene er den lukkingen, og den skal ikke være en
// oppsummering — den skal si det ene kurset egentlig handlet om.
//
// Det er også kapitlet som slutter der seeren står, og det er meningen.
// Kurset er skrevet på norsk først, og det som Hansen låste inne i et
// laboratorium i København hadde hengt og tørket på et stabbur i Voss hele
// tiden, uten at noen kalte det vitenskap.
//
// Fare å styre unna: nasjonal selvskryt. Kveik er ikke bedre enn annen gjær.
// Den er ANNERLEDES, og den overlevde fordi ingen visste at den var verdt å
// standardisere bort. Det er en heldig ulykke, ikke en bragd.

---
id: chapter-6-kveik
pack: beer
title: Kveiken i stabburet | The kveik in the loft
subtitle: Norsk gardsøl, og gjæren som overlevde | Norwegian farmhouse ale, and the yeast that survived
---

# places
voss  60.6297, 6.4136  zoom=10.4  kind=town  Voss
bergen  60.3913, 5.3221  zoom=9.6  kind=city  Bergen
europa  55.0, 8.0  zoom=4.2  kind=region  Europa | Europe

# ending
say: Fire ting, og den fjerde er i live. Det var hele kurset. | Four things, and the fourth one is alive. That was the whole course.
figure.value: 4
figure.label: ingredienser, og du vet nå hvorfor det holder | ingredients, and now you know why that is enough

## Hjem | Home
bed: bedBrew

{plate stabbur motion=in over=25 dim=0.14 push=0.09 into=1.4} Vi har vært i England, i Bayern, i Böhmen, i København og i Belgia.
> We have been to England, to Bavaria, to Bohemia, to Copenhagen and to Belgium.
Nå skal vi hjem, og det er ikke av høflighet. Det er fordi noe ble liggende her.
> Now we are going home, and it is not out of politeness. It is because something was left lying here.

Mens gjæren ble låst inne i laboratorier og sendt ut igjen med nummer på, hang det en tørket krans av den på et stabbur på Vestlandet.
> While yeast was being locked into laboratories and sent out again with numbers on it, a dried ring of it was hanging in a loft in western Norway.
Ingen kalte det vitenskap. De kalte det kveik. {mark term:kveik}
> Nobody called it science. They called it kveik. {^}

## Hver gard sitt øl | Every farm its own beer
bed: bedBrew

{plate.hide 1.1} {plate gardskjokken motion=left over=24 dim=0.15 push=0.13 into=1.4} I hundrevis av år brygget nesten hver eneste gard i Norge sitt eget øl. {mark term:gardsol}
> For hundreds of years almost every farm in Norway brewed its own beer. {^}
Ikke som hobby. Det sto i loven. Gulatingsloven krevde at bøndene brygget til jul, og bøtene sto der svart på hvitt.
> Not as a hobby. It was in the law. The Gulating law required farmers to brew for Christmas, and the fines were written down in black and white.

Ølet hørte til de store dagene. Jul, bryllup, barnedåp, gravøl.
> The beer belonged to the big days. Christmas, weddings, christenings, funerals.

{plate.hide 1.1} {plate einer-lag motion=in over=23 dim=0.14 push=0.09 into=1.4} Og de brygget det med det som vokste utenfor døra.
> And they brewed it with what grew outside the door.
Einer i stedet for humle, eller ved siden av. Einerlåg — vann kokt på einerbar — i stedet for rent vann.
> Juniper instead of hops, or alongside them. Juniper infusion — water boiled on juniper branches — instead of plain water.

Det er ikke folklore. Det er den samme regelen som har gått gjennom hele kurset: du bruker det stedet har.
> That is not folklore. It is the same rule that has run through this whole course: you use what the place has.

## Kransen på stabburet | The ring in the loft
bed: bedBrew

{flyTo voss zoom=6.2 over=4.0} {marker voss label=Voss kind=point tone=gold} Men det er den fjerde ingrediensen som gjør dette til noe annet.
> But it is the fourth ingredient that makes this something else.
{plate.hide 1.1} {plate gjaerkrans motion=in over=26 dim=0.15 push=0.08 into=1.4} Når ølet gjæret, dyppet de en trekrans ned i skummet. {mark term:gjaerkrans}
> When the beer was fermenting, they dipped a wooden ring down into the foam. {^}

En flettet ring, eller en pinne, eller en stokk med hull i. Så hengte de den til tørk i stabburet.
> A plaited ring, or a stick, or a log with holes bored in it. Then they hung it up to dry in the loft.
{plate.hide 1.1} {plate stabbur-inne motion=in over=22 dim=0.14 push=0.09 into=1.4} Gjæren tørket inn i treverket og ble liggende der. I et år. Noen ganger i flere.
> The yeast dried into the timber and stayed there. For a year. Sometimes for several.

Neste gang det skulle brygges, la de kransen i vørteren, og den våknet.
> Next time there was brewing to do, they put the ring into the wort, and it woke up.

Det ordet, kveik, betyr rett og slett noe man tenner med. Det samme ordet som i å kveike et bål.
> That word, kveik, simply means something you light a fire with. The same word as in kindling.

## Det den tåler | What it survives
bed: none

{plate.hide 1.1} {plate varm-gjaering motion=in over=24 dim=0.15 push=0.09 into=1.4} Og så kommer det som gjorde at resten av verden til slutt måtte høre etter.
> And then comes the thing that made the rest of the world eventually have to listen.
Vanlig ale-gjær vil ha atten til tjueto grader. Over tjuefem begynner den å lage stoffer som smaker av løsemiddel.
> Ordinary ale yeast wants eighteen to twenty-two degrees. Above twenty-five it starts making compounds that taste of solvent.

{compare part=9 "9 °C" lager Lager | Lager part=20 "20 °C" ale Ale | Ale part=37 "37 °C" wild Kveik | Kveik mode=bar note=Hvor varmt gjæren vil ha det. | How warm the yeast wants it.} Kveik gjærer på trettifem. Noen stammer på over førti. {mark term:hoy-gjaeringstemperatur}
> Kveik ferments at thirty-five. Some strains above forty. {^}

{compare.clear} Og den lager ikke løsemiddel. Den lager appelsin og tropisk frukt, og den er ferdig på to døgn.
> And it does not make solvent. It makes orange and tropical fruit, and it is finished in two days.
{plate.hide 1.1} {plate gardskjokken motion=in over=21 dim=0.15 push=0.09 into=1.4} Bøndene visste ikke hvorfor. De visste bare at ølet ble ferdig fort, og at det ikke ble surt.
> The farmers did not know why. They only knew the beer was done quickly, and that it did not go sour.

## Uten at noen kalte det vitenskap | Without anybody calling it science
bed: bedBrew

{plate.hide 1.1} {plate stabbur-inne motion=in over=25 dim=0.14 push=0.09 into=1.4} Tenk på hva en slik krans egentlig er.
> Think about what a ring like that actually is.
Det er den samme gjæren, holdt i live og videreført på én gard, gjennom generasjoner. Noen av dem er sporet mer enn to hundre år tilbake.
> It is the same yeast, kept alive and carried on at one farm, through generations. Some of them have been traced back more than two hundred years.

De har navn etter familien eller garden de kom fra. Ikke etter en art, og ikke etter et nummer.
> They are named after the family or the farm they came from. Not after a species, and not after a number.

{plate.hide 1.1} {plate gjaerkake-krukke motion=out over=22 dim=0.14 push=0.12 into=1.4} Emil Christian Hansen brukte et laboratorium og et mikroskop for å få tak i noe som lignet.
> Emil Christian Hansen used a laboratory and a microscope to get hold of something similar.
Her gjorde de omtrent det samme med en trepinne og et kaldt loft, i flere hundre år, uten å vite at det var det de gjorde.
> Here they did roughly the same thing with a piece of wood and a cold loft, for several hundred years, without knowing that was what they were doing.

Det er ikke fordi de var flinkere. Det er fordi ingen hadde fortalt dem at gjæren deres burde byttes ut.
> It is not because they were cleverer. It is because nobody had told them their yeast ought to be replaced.

## Og så fant verden den | And then the world found it
bed: bedBrew

{plate.hide 1.1} {marker.clear} {flyTo europa zoom=4.2 over=4.6} {marker voss label=Voss kind=point tone=gold} Rundt tjuehundreogfjorten begynte en norsk ølhistoriker, Lars Marius Garshol, å reise rundt og skrive ned det som var igjen.
> Around twenty fourteen a Norwegian beer historian, Lars Marius Garshol, started travelling around and writing down what was left.
Han fant førti gårder som fortsatt brygget, og han fikk kransene analysert.
> He found forty farms still brewing, and he had the rings analysed.

{plate.hide 1.1} {plate handverksbryggeri motion=in over=24 dim=0.15 push=0.09 into=1.4} Det som kom ut av laboratoriet var oppsiktsvekkende. Kveik er ikke én gjær, men mange, og flere av dem er ulike alt som var beskrevet fra før.
> What came out of the laboratory was striking. Kveik is not one yeast but many, and several of them are unlike anything described before.

Og for et håndverksbryggeri {mark term:handverksbryggeri} er den praktisk på en måte ingen hadde forutsett.
> And for a craft brewery {^} it is useful in a way nobody had foreseen.
En gjær som er ferdig på to døgn i romvarme sparer både tid og kjøling. Og frukta den lager passer perfekt til en moderne ipa.
> A yeast that finishes in two days at room temperature saves both time and refrigeration. And the fruit it makes suits a modern IPA perfectly.

{plate.hide 1.1} {plate torrhumling motion=in over=23 dim=0.14 push=0.09 into=1.4} Der man har i store mengder humle etter gjæringen, bare for lukten. {mark term:torrhumling}
> Where you throw in large amounts of hops after fermentation, purely for the aroma. {^}

I dag brygges det med kveik fra Voss i New Zealand, i Brasil og i USA. Gjæren fra stabburet har fått et kundenummer.
> Today there is brewing with kveik from Voss in New Zealand, in Brazil and in the United States. The yeast from the loft has been given a customer number.

## Fire ting | Four things
bed: bedBrew

{plate.hide 1.1} {marker.clear} {plate fire-raavarer motion=in over=26 dim=0.14 push=0.08 into=1.4} Så er vi tilbake der vi begynte.
> So we are back where we started.
Vann, korn, humle og gjær. Tre du kan veie opp på en kjøkkenvekt, og én som lever.
> Water, grain, hops and yeast. Three you could weigh on a kitchen scale, and one that is alive.

Alt vi har sett siden har vært den samme historien fortalt seks ganger.
> Everything we have seen since has been the same story told six times.
{plate.hide 1.1} {plate gjaerkrans motion=in over=22 dim=0.15 push=0.08 into=1.4} Burton hadde gips i vannet. Bayern hadde is. Plzeň hadde ingenting i vannet i det hele tatt. København fanget den. Brussel slapp den inn. Voss hengte den til tørk.
> Burton had gypsum in the water. Bavaria had ice. Plzeň had nothing in the water at all. Copenhagen caught it. Brussels let it in. Voss hung it up to dry.

{plate.hide 1.1} {plate pub-lyst-og-morkt motion=in over=24 dim=0.13 push=0.09 into=1.4} Og spørsmålet vi startet med er besvart.
> And the question we started with has been answered.
Øl smaker av tusen ting, selv om det er laget av fire, fordi den fjerde ikke er en ingrediens du måler opp.
> Beer tastes of a thousand things, even though it is made of four, because the fourth one is not an ingredient you measure out.
Den er i live, den er forskjellig fra sted til sted, og i tusen år bestemte den mer enn noen skjønte.
> It is alive, it is different from place to place, and for a thousand years it decided more than anybody understood.

Neste gang du får et glass i handa, er det verdt å tenke på at tre av tingene i det ble veid opp, og at den fjerde kom et sted fra.
> Next time you have a glass in your hand, it is worth thinking that three of the things in it were weighed out, and that the fourth one came from somewhere.
