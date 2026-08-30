// chapter-5-belgia, skrevet som prosa. Kapittel-JSON kompileres fra denne
// fila og er det motoren laster; --check sier om de to fortsatt sier det samme.
//
//     python tools/author.py content/beer/script.chapter-5-belgia.md --check
//     python tools/author.py content/beer/script.chapter-5-belgia.md --write
//     python tools/narrate.py --chapter beer/chapter-5-belgia --lang no
//
// DETTE ER MOTARGUMENTET, og det står med vilje rett etter kapittel fire.
// Der handlet alt om å få kontroll over den fjerde ingrediensen: én celle,
// dyrket fram, sendt i posten, lik hver gang. Her er de som lot være.
//
// Kapitlet må ikke bli en hyllest. Poenget er ikke at det ville er bedre enn
// det rene — det er at «feil» og «stil» er det samme stoffet sett fra to
// kanter. Brettanomyces fikk navnet sitt fordi den ØDELA engelsk øl. I
// Brussel er den hele poenget. Samme sopp, samme lukt, motsatt dom.
//
// Kartet kommer fram to ganger: én gang for å vise hvor lite området er, og
// én gang for å vise at det er alt.

---
id: chapter-5-belgia
pack: beer
title: De som lot vinduet stå åpent | The ones who left the window open
subtitle: Belgia, og gjæren som kommer utenfra | Belgium, and the yeast that comes in from outside
---

# places
brussel  50.8503, 4.3517  zoom=9.6  kind=city  Brussel | Brussels
pajottenland  50.7800, 4.1200  zoom=10.8  kind=region  Pajottenland
europa  50.5, 9.0  zoom=4.6  kind=region  Europa | Europe

# ending
say: Samme sopp, samme lukt, motsatt dom. Neste gang: en trekrans i et stabbur på Voss. | The same fungus, the same smell, the opposite verdict. Next time: a wooden ring in a loft at Voss.
figure.value: 3
figure.label: år i fat, før noen smaker på det | years in a barrel, before anybody tastes it

## De som lot være | The ones who did not
bed: bedBrew

{plate loftsvindu motion=in over=24 dim=0.15 push=0.09 into=1.4} Alt vi har sett til nå handler om å få kontroll.
> Everything we have seen so far is about getting control.
Kald kjeller. Ren gjær. Pasteurisering. Fire hundre år med å stenge det ville ute.
> Cold cellar. Clean yeast. Pasteurisation. Four hundred years of shutting the wild out.

Så er det ett lite område i Europa som gjorde det motsatte, med vilje, og fortsatt gjør det.
> Then there is one small area in Europe that did the opposite, deliberately, and still does.
De bygde takene sine slik at gjæren skulle komme INN.
> They built their roofs so the yeast could get IN.

## Karet på loftet | The vessel in the loft
bed: bedBrew

{plate.hide 1.1} {plate kjoleskip motion=left over=26 dim=0.15 push=0.13 into=1.4} På loftet i bryggeriet står et kar som ikke ligner på noe annet i dette kurset.
> In the loft of the brewery stands a vessel that looks like nothing else in this course.
Det er vidt og flatt og åpent. Som et svømmebasseng av kobber, tjue centimeter dypt.
> It is wide and flat and open. Like a swimming pool made of copper, twenty centimetres deep.

Det heter et kjøleskip. {mark term:kjoleskip} Den varme vørteren pumpes opp dit om kvelden og får ligge natta over.
> It is called a coolship. {^} The hot wort is pumped up there in the evening and left to lie overnight.
Det er flatt fordi det skal kjøle seg ned fort. Det er åpent fordi det skal få besøk.
> It is flat so it cools quickly. It is open so that it gets visitors.

{plate.hide 1.1} {plate takluker motion=in over=23 dim=0.14 push=0.09 into=1.4} Lukene i taket står åpne. Ingen har tilsatt gjær, og ingen kommer til å gjøre det.
> The louvres in the roof stand open. Nobody has added yeast, and nobody is going to.
Det som lever i lufta og i treverket faller ned i vørteren av seg selv.
> Whatever lives in the air and in the timber falls into the wort by itself.

Det heter spontangjæring, {mark term:spontangjaering} og det er den eldste måten å lage øl på. Det er også den eneste som er igjen.
> That is called spontaneous fermentation, {^} and it is the oldest way to make beer. It is also the only one left.

## Dalen der det virker | The valley where it works
bed: bedBrew

{flyTo brussel zoom=6.0 over=4.0} {marker brussel label=Brussel kind=point} Og det virker bare ett sted.
> And it only works in one place.
{plate.hide 1.1} {plate senne-dal motion=out over=24 dim=0.15 push=0.14 into=1.4} Vest for Brussel ligger en dal langs elva Senne. Området heter Pajottenland, og det er lite. Tjue ganger tretti kilometer.
> West of Brussels lies a valley along the river Senne. The area is called Pajottenland, and it is small. Twenty kilometres by thirty.

Ølet som blir til der heter lambik. {mark term:lambik}
> The beer that comes about there is called lambic. {^}
Prøver du det samme i Oslo, får du noe annet. Ofte noe udrikkelig.
> Try the same thing in Oslo and you get something else. Often something undrinkable.

Lufta over den dalen har en blanding av gjærsopper og bakterier som ingen har satt sammen og ingen kan flytte.
> The air over that valley has a mixture of yeasts and bacteria that nobody put together and nobody can move.

## Soppen som fikk skylda | The fungus that took the blame
bed: none

{plate.hide 1.1} {marker.clear} {plate brett-fat motion=in over=27 dim=0.16 push=0.08 into=1.4} Én av dem er verdt et eget navn.
> One of them is worth a name of its own.
Den heter brettanomyces, {mark term:brettanomyces} og navnet betyr «den britiske soppen».
> It is called Brettanomyces, {^} and the name means "the British fungus".

Den fikk det navnet i nittenhundreogfire fordi en dansk forsker fant ut hva som ØDELA engelsk øl.
> It got that name in nineteen oh four because a Danish scientist worked out what was RUINING English beer.
{plate.hide 1.1} {plate laer-stall motion=in over=22 dim=0.15 push=0.09 into=1.4} Den lager lukter man i et bryggeri kaller feil: fjøs, hestedekken, lær, plaster.
> It makes smells that a brewery calls faults: barnyard, horse blanket, leather, sticking plaster.

{fact term:brettanomyces} Og i Pajottenland er akkurat det poenget.
> And in Pajottenland that is exactly the point.
Samme sopp. Samme lukt. Motsatt dom.
> The same fungus. The same smell. The opposite verdict.

Det er ikke fordi belgierne har dårlig smak. Det er fordi en feil er en feil bare når du prøvde på noe annet.
> It is not because the Belgians have bad taste. It is because a fault is only a fault when you were trying to do something else.

## Tre år, og så blandes det | Three years, and then it is blended
bed: bedBrew

{plate.hide 1.1} {plate fathall motion=in over=25 dim=0.15 push=0.09 into=1.4} Lambik har det ikke travelt. Den ligger på gamle trefat i ett, to eller tre år.
> Lambic is in no hurry. It lies in old wooden barrels for one, two or three years.
Underveis skifter den. Det første året er den frisk og syrlig. Det tredje er den tørr, dyp og litt merkelig.
> It changes on the way. The first year it is fresh and tart. By the third it is dry, deep and slightly strange.

{plate.hide 1.1} {plate blandekunst motion=in over=24 dim=0.14 push=0.09 into=1.4} Så gjør bryggeren det som egentlig er håndverket her. Han blander.
> Then the brewer does the thing that is really the craft here. He blends.
Ung lambik med sukker igjen i, gammel lambik med smaken, og resultatet fylles på flaske mens det fortsatt lever.
> Young lambic with sugar still in it, old lambic with the flavour, and the result goes into a bottle while it is still alive.

Det gjærer ferdig inne i flaska. {mark term:flaskegjaering} Da lager det sin egen kullsyre, og korken må bindes fast.
> It finishes fermenting inside the bottle. {^} That makes its own carbonation, and the cork has to be wired down.
Blandingen heter geuze. {mark term:geuze}
> The blend is called gueuze. {^}

{plate.hide 1.1} {plate kriek-kirsebaer motion=in over=23 dim=0.14 push=0.09 into=1.4} Og har du kirsebær, kaster du dem oppi et fat lambik og venter et halvt år til.
> And if you have cherries, you throw them into a barrel of lambic and wait another six months.
Gjæren spiser sukkeret i frukta, så det blir ikke søtt. Det blir surt og rødt. Det heter kriek. {mark term:kriek}
> The yeast eats the sugar in the fruit, so it does not turn sweet. It turns sour and red. That is called kriek. {^}

## Klosteret og gården | The monastery and the farm
bed: bedBrew

{plate.hide 1.1} {plate kloster-gang motion=in over=25 dim=0.14 push=0.09 into=1.4} Belgia har to tradisjoner til, og de deler den samme trassen.
> Belgium has two more traditions, and they share the same stubbornness.
I noen klostre brygger munkene fortsatt selv, og selger for å drive stedet. Det ølet kalles trappist. {mark term:trappist}
> In some monasteries the monks still brew themselves, and sell it to keep the place going. That beer is called trappist. {^}
Det er sterkt, det gjærer varmt, og det gjærer om igjen i flaska.
> It is strong, it ferments warm, and it ferments again in the bottle.

{plate.hide 1.1} {plate gard-belgia motion=out over=24 dim=0.14 push=0.13 into=1.4} Og på gårdene i sør brygget de om vinteren et øl til sommerens arbeidsfolk.
> And on the farms in the south they brewed a beer in winter for the summer's workers.
Tørt, krydret, ikke sterkt, laget for å drikkes av folk som skulle jobbe videre etterpå. Det heter saison. {mark term:saison}
> Dry, spicy, not strong, made for people who had to keep working afterwards. It is called saison. {^}

Ingen av delene er ville på lambikens måte. Men ingen av dem er renset heller.
> Neither of them is wild in the way lambic is. But neither of them is cleaned up either.

## Feil, eller stil | A fault, or a style
bed: bedBrew

{plate.hide 1.1} {flyTo europa zoom=4.6 over=4.6} {marker pajottenland label=Pajottenland kind=point tone=gold} Se på det på kartet en siste gang.
> Look at it on the map one last time.
Hele denne tradisjonen får plass i en firkant du knapt ser herfra.
> This entire tradition fits in a square you can barely see from here.

{stat 600 label=kvadratkilometer, og resten av verden | square kilometres, and the rest of the world side=wild} Resten av kartet gjorde det motsatte, og hadde gode grunner.
> The rest of the map did the opposite, and had good reasons.

{stat.clear} {plate.hide 1.1} {plate lambik-glass motion=in over=24 dim=0.13 push=0.09 into=1.4} Men legg merke til hva dette kapitlet egentlig har vist.
> But notice what this chapter has really shown.
Det samme stoffet, laget av den samme soppen, er en katastrofe i en pils og hele poenget i en geuze.
> The same compound, made by the same fungus, is a disaster in a pilsner and the entire point in a gueuze.

Forskjellen ligger ikke i ølet. Den ligger i hva bryggeren prøvde på.
> The difference is not in the beer. It is in what the brewer was trying to do.

Neste gang skal vi hjem. For mens gjæren ble låst inne i laboratorier, hang det en tørket krans av den på et stabbur på Voss.
> Next time we are going home. Because while yeast was being locked up in laboratories, a dried ring of it was hanging in a loft at Voss.
