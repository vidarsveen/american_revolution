// Kapittel 1: Fire ting i et glass. Dette er kapitlet slik en person skriver
// det; chapter-1-fire-ting.json kompileres herfra og er det motoren laster.
//
//     python tools/author.py content/beer/script.chapter-1-fire-ting.md --check
//     python tools/author.py content/beer/script.chapter-1-fire-ting.md --write
//     python tools/narrate.py --chapter beer/chapter-1-fire-ting --lang no
//
// Den vanlige linja er norsk, skrevet først; `>`-linja under er engelsk.
// En cue i {krøllparentes} fyrer på ordet den står rett etter, og {^} merker
// det samme ordet i den engelske setningen når språkene bruker hvert sitt.
// En blank linje mellom to setninger er en lengre pause.
//
// docs/authoring.md skriver et kapittel fra ingenting, og
// `python tools/author.py --verbs` lister hver eneste cue.
//
// HVA DETTE KAPITLET ER TIL FOR, fra outline.md — hvis det du skriver
// slutter å svare på dette, er det outline.md som skal endres, ikke
// denne kommentaren:
//
//   Å gi ordene resten av kurset hviler på, og å legge den store spaken
//   på bordet med én gang: tre av de fire ingrediensene kan veies, og
//   den fjerde lever. Alt som kommer etterpå er en historie om å styre
//   den levende. Kapitlet har ingen stedsnavn i seg før helt til slutt,
//   der bakken kommer til syne og ingenting er satt på den.
//
// DETTE KAPITLET HAR INGEN GRUNN. `ground: none` i front matter tar
// kartflaten ut for dette kapitlet alene — ikke skjult, men ikke montert,
// så verken kartmodulen eller geometrien lastes. Mellom bildene er det
// papir. Målt før: to minutter og seks sekunder av ti gikk med til et
// stillestående kart over Nordsjøen, i mellomrommene. Pakken har
// fortsatt `map` i surfaces, fordi kapittel to til seks handler om
// steder; dette gjør ikke det.

---
id: chapter-1-fire-ting
pack: beer
title: Fire ting i et glass | Four things in a glass
subtitle: Vann, korn, humle og gjær | Water, grain, hops and yeast
ground: none
---

# ending
say: Fire ting, fire trinn, og én av dem er i live. Alt som kommer nå, handler om den. | Four things, four steps, and one of them is alive. Everything from here is about that one.
figure.value: 4
figure.label: ingredienser i nesten all øl | ingredients in nearly all beer

## Fire ting | Four things

{music bedBrew} {plate fire-raavarer motion=in over=26 dim=0.14 push=0.1 into=1.4} Øl er fire ting. {stat 4 label=ingredienser | ingredients side=neutral} Vann, korn, humle og gjær.
> Beer is four things. {^} Water, grain, hops and yeast.
Tre av dem kan du veie opp på en kjøkkenvekt. Den fjerde er i live.
> Three of them you could weigh out on a kitchen scale. The fourth one is alive.

{stat.clear} Det er hele kurset i én setning. Nesten alt som kommer, handler om å styre noe levende som ingen kunne se.
> That is the whole course in one sentence. Nearly everything that follows is about controlling something alive that nobody could see.
{plate.hide 1.1} {plate bryggeri-rom motion=right over=24 dim=0.13 push=0.12 into=1.4} Men det gir ingen mening før vi vet hva de fire faktisk gjør. Så vi begynner der.
> But none of it makes sense until we know what the four of them actually do. So we start there.

I dag er det ikke ett stedsnavn i dette kapitlet. Ingen byer, ingen land, ingen årstall.
> Today there is not one place name in this chapter. No cities, no countries, no dates.
Bare et bryggeri. Det kan stå hvor som helst, og det gjør akkurat det samme.
> Just a brewery. It could be standing anywhere, and it does exactly the same thing.

## Nesten bare vann | Almost entirely water

{plate glass-mot-vindu motion=in over=18 dim=0.12 push=0.08 into=1.4} Hell opp et glass. Rundt nittifem {stat 95% label=av et glass øl er vann | of a glass of beer is water side=vann} prosent av det du ser på er vann.
> Pour a glass. About ninety-five per cent {^} of what you are looking at is water.
Det høres ut som en fotnote. Det er tvert imot den ingrediensen som bestemte mest, lengst.
> That sounds like a footnote. It is in fact the ingredient that decided the most, for the longest.

{stat.clear} For vann er aldri bare vann. Det som er løst i det følger med inn i ølet.
> Because water is never just water. Whatever is dissolved in it comes into the beer with it.
{plate kalk-vann motion=left over=26 dim=0.14 push=0.16 into=1.4} Kalk, gips og salt fra bakken under brønnen. Du smaker det ikke direkte, men det endrer alt annet.
> Chalk, gypsum and salt from the ground under the well. You do not taste it directly, but it changes everything else.
Hardt vann gjør bitterheten skarp og tydelig. Bløtt vann gjør den rund og myk.
> Hard water makes bitterness sharp and pointed. Soft water makes it round and soft.

Og i flere hundre år kunne ingen gjøre noe med det. Man brygget med vannet man hadde.
> And for several hundred years nobody could do anything about it. You brewed with the water you had.
{plate.hide 1.1} {plate bybronn motion=in over=18 dim=0.14 push=0.08 into=1.4} En by fikk det ølet brønnen under den ga. Ikke fordi noen valgte det, men fordi det var det eneste vannet som fantes.
> A town got the beer its own well gave it. Not because anybody chose it, but because that was the only water there was.
Hold på den tanken. Den kommer tilbake i neste kapittel, og da er den halve svaret.
> Hold on to that. It comes back in the next chapter, and there it is half the answer.

## Kornet som blir lurt | The grain that gets tricked

{plate bygg-aker motion=left over=22 dim=0.13 push=0.14 into=1.4} Den andre ingrediensen er korn, og nesten alltid bygg. {mark topic:hvorfor-bygg span=1}
> The second ingredient is grain, and nearly always barley. {^}
Et byggkorn er en pakke stivelse med en plante sovende inni.
> A grain of barley is a package of starch with a plant asleep inside it.
Og stivelse kan ikke gjæres. Gjær spiser sukker, ikke stivelse.
> And starch cannot be fermented. Yeast eats sugar, not starch.

Så bryggeren lurer kornet. Det legges i vann i to døgn, og tror det er blitt vår.
> So the brewer tricks the grain. It is soaked for two days, and thinks spring has arrived.
{plate spirende-korn motion=in over=26 dim=0.16 push=0.1 into=1.4} Kornet begynner å spire. Og mens det spirer, bygger det verktøyet det trenger for å gjøre sin egen stivelse om til sukker.
> The grain starts to sprout. And while it sprouts, it builds the tools it needs to turn its own starch into sugar.
Akkurat da blir det tørket. Planten dør. Verktøyet overlever, og stivelsen ligger urørt igjen.
> At exactly that moment it is dried. The plant dies. The tools survive, and the starch is left untouched.
Det ferdige kornet heter malt. {mark term:malt}
> The finished grain is called malt. {^}

Hvor varmt malten tørkes til slutt bestemmer fargen, og det er en spak med stort utslag.
> How hot the malt is dried at the end decides the colour, and it is a lever with a long throw.
{plate malt-fargeskala motion=right over=24 dim=0.12 push=0.12 into=1.4} Tørkes den forsiktig, blir den lys og smaker brød og kjeks.
> Dried gently, it stays pale and tastes of bread and biscuit.
Tørkes den varmere, blir den til karamell. Brennes den, blir den nesten svart og smaker kaffe og mørk sjokolade.
> Dried hotter, it turns to caramel. Roasted, it goes nearly black and tastes of coffee and dark chocolate.

Det betyr noe som overrasker de fleste. Et mørkt øl er ikke sterkere enn et lyst.
> Which means something that surprises most people. A dark beer is not stronger than a pale one.
Fargen sier bare hvor hardt kornet er brent. Ikke noe mer.
> The colour only says how hard the grain was roasted. Nothing more.

## Mesken og kokekaret | The mash and the kettle

{plate mesk-damp motion=in over=30 dim=0.16 push=0.09 into=1.4} Nå skal sukkeret ut av malten, og det skjer i varmt vann.
> Now the sugar has to come out of the malt, and that happens in hot water.
Malten knuses grovt og røres ut i vann på rundt sekstiseks {stat 66°C label=mesketemperatur | mash temperature side=korn} grader. {mark term:mesking}
> The malt is crushed coarsely and stirred into water at about sixty-six degrees. {^1} {^2}
Ikke kokende, og det er viktig. Verktøyet fra maltingen dør over rundt sytti grader.
> Not boiling, and that matters. The tools from the malting die above about seventy degrees.

{stat.clear} Verktøyet har et navn: enzymer. Det er molekyler som klipper stivelse i biter små nok til at gjær kan spise dem.
> The tools have a name: enzymes. They are molecules that cut starch into pieces small enough for yeast to eat.
{plate.hide 1.1} {plate vorter-glass motion=in over=26 dim=0.14 push=0.07 into=1.4} Etter en times tid er væska søt. Den heter vørter, {mark term:vorter} og den smaker omtrent som lunken kornsuppe.
> After an hour or so the liquid is sweet. It is called wort, {^} and it tastes rather like lukewarm cereal.

Temperaturen i mesken er en spak til. To grader kaldere gir gjæren mer å spise, og ølet blir tørrere og sterkere.
> The mash temperature is another lever. Two degrees cooler gives the yeast more to eat, and the beer comes out drier and stronger.
To grader varmere lar mer bli igjen, og ølet blir fyldigere og søtere.
> Two degrees warmer leaves more behind, and the beer comes out fuller and sweeter.
{plate.hide 1.1} {plate mesk-termometer motion=in over=22 dim=0.14 push=0.08 into=1.4} Samme malt, samme oppskrift, to grader. Slike forskjeller er hele dette faget.
> Same malt, same recipe, two degrees. Differences like that are the whole subject.

{plate kok-fosskok motion=in over=24 dim=0.18 push=0.08 into=1.4} Så kokes vørteren hardt i omtrent en time. {mark term:kok}
> Then the wort is boiled hard for about an hour. {^}
Alt levende i den dør, så gjæren bryggeren selv har valgt får hele karet for seg selv.
> Everything alive in it dies, so the yeast the brewer has chosen gets the whole vessel to itself.
Protein klumper seg sammen og faller ut. Det er derfor øl i det hele tatt kan bli klart.
> Protein clumps together and falls out. That is why beer can be clear at all.
Og det er nå humla går oppi.
> And this is when the hops go in.

## Konglen som reddet ølet | The cone that saved beer

{plate humlehage motion=out over=20 dim=0.12 push=0.16 into=1.4} Humle er en slyngplante i hampefamilien. {mark term:humle}
> The hop is a climbing plant in the hemp family. {^}
Den klatrer sju {stat 7 m label=på én sommer | in a single summer side=humle} meter opp en snor i løpet av én sommer.
> It goes seven metres {^} up a string in a single summer.
Det er hunnplantens kongler bryggeren vil ha. Inni dem sitter gule korn som heter lupulin.
> It is the female plant's cones the brewer wants. Inside them sit yellow grains called lupulin.

{stat.clear} De kornene gjør to ting, og bare den ene handler om smak.
> Those grains do two things, and only one of them is about taste.
{plate humlekongle-snitt motion=in over=27 dim=0.14 push=0.07 into=1.4} Det ene er bitterhet. {mark term:bitterhet} Malten har fylt vørteren med sukker, og uten en motvekt smaker øl som sirup.
> The first is bitterness. {^} The malt has filled the wort with sugar, and without a counterweight beer tastes like syrup.
Det andre er at humle dreper bakterier. Øl med humle i holdt seg. Øl uten ble surt.
> The second is that hops kill bacteria. Hopped beer kept. Unhopped beer went sour.
Før det fantes kjøling var det hele forskjellen mellom et øl som overlevde vinteren og et som ikke gjorde det.
> Before refrigeration, that was the entire difference between a beer that survived the winter and one that did not.
{plate.hide 1.1} {plate humle-torking motion=in over=20 dim=0.13 push=0.08 into=1.4} Det er derfor humle vant. Ikke fordi den smakte best, men fordi den holdt lengst.
> That is why hops won. Not because they tasted best, but because they kept longest.

{fact term:bitterhet} {plate.hide 1.1} Bitterhet måles i noe som heter IBU. {compare part=15 "15" korn Lys lager | Pale lager part=35 "35" humle Pils | Pilsner part=65 "65" gjaer Moderne IPA | Modern IPA mode=bar note=Bitterhet i IBU. Tallet betyr ingenting uten sukkeret det leses mot. | Bitterness in IBU. The number means nothing without the sugar it is read against.}
> Bitterness is measured in something called IBU. {^}
En lys lager ligger rundt femten. En pils rundt trettifem. En moderne IPA kan ligge over seksti.
> A pale lager sits around fifteen. A pilsner around thirty-five. A modern IPA can be over sixty.
Men tallet alene sier ikke hvor bittert noe smaker, for bitterhet leses alltid mot sukkeret som er igjen.
> But the number alone does not say how bitter a thing tastes, because bitterness is always read against the sugar left behind.

{compare.clear} Og så er det timingen, som er det virkelig pene med humle.
> And then there is the timing, which is the genuinely elegant part.
{plate humle-i-kok motion=in over=31 dim=0.16 push=0.1 into=1.4} Bitterstoffet må koke lenge for å løse seg i væska i det hele tatt. Så humle som skal gjøre ølet bittert, går oppi tidlig.
> The bitter resin has to boil for a long time to dissolve at all. So hops meant to make the beer bitter go in early.
Oljene som lukter av sitrus, gress og furu koker rett av. Så humle som skal gi lukt, går oppi helt til slutt.
> The oils that smell of citrus, grass and pine boil straight off. So hops meant to give smell go in at the very end.
Samme plante, samme gryte, to helt forskjellige jobber. Det eneste som skiller dem er når den går oppi.
> Same plant, same kettle, two completely different jobs. The only thing separating them is when it goes in.

## Den fjerde er i live | The fourth one is alive

{plate gjaer-torr motion=in over=20 dim=0.14 push=0.08 into=1.4} De tre første kan veies opp og skrives på en liste. Nå kommer den som ikke kan det.
> The first three can be weighed out and written on a list. Now comes the one that cannot.
Gjær er en sopp på én eneste celle. {mark term:gjaer}
> Yeast is a fungus one single cell across. {^}
Det er omtrent tjue milliarder {stat 20 mrd label=gjærceller i ett gram | yeast cells in one gram side=gjaer} av dem i ett eneste gram tørrgjær.
> There are about twenty billion {^} of them in a single gram of dried yeast.

{stat.clear} {plate.hide 1.1} {plate gjaering-skum motion=in over=27 dim=0.15 push=0.09 into=1.4} Jobben er enkel å beskrive. Gjæren spiser sukker og gir fra seg alkohol og kullsyre. {mark term:gjaering}
> The job is simple to describe. The yeast eats sugar and gives off alcohol and carbon dioxide. {^}
Alkoholen er avfall. Den lages ikke for vår skyld, men for å holde alt annet levende unna sukkeret.
> The alcohol is a waste product. It is not made for our sake, but to keep everything else alive away from the sugar.
En vanlig ale er ferdig på tre til fem døgn. Det bobler kraftig, og det lukter bakeri.
> An ordinary ale is done in three to five days. It bubbles hard, and it smells of a bakery.

{plate gjaerkake-krukke motion=left over=29 dim=0.16 push=0.11 into=1.4} Og her er det merkelige: i fem tusen år visste ingen at gjær fantes. {mark topic:ol-for-vi-visste span=1}
> And here is the strange part: for five thousand years nobody knew yeast existed. {^}
Bryggeren tok vare på skummet fra forrige brygg og hadde det oppi det neste.
> The brewer saved the foam from the last batch and put it into the next.
Det ble arvet, lånt bort og gitt i bryllupsgave. Ingen visste at det de flyttet på var milliarder av levende celler.
> It was inherited, lent out and given as a wedding present. Nobody knew that what they were moving was billions of living cells.
Louis Pasteur viste først i attenfemtisju at gjæring er noe levende som spiser.
> Louis Pasteur only showed in 1857 that fermentation is something living, feeding.

{plate.hide 1.1} {plate estere-frukt motion=left over=26 dim=0.12 push=0.14 into=1.4} Og gjæren gjør mye mer enn alkohol. Den lager smaker ingen har hatt oppi. {mark topic:hva-er-en-ester span=1}
> And the yeast does far more than alcohol. It makes flavours nobody put in. {^}
Banan, nellik, eple, pære, roser. Stoffene heter estere, og nesa vår kjenner noen få milliondeler av dem.
> Banana, clove, apple, pear, roses. The compounds are called esters, and our noses pick up a few parts per million.
Hvor mye gjæren lager av dem, styres nesten bare av én ting: hvor varmt den får stå.
> How much of them the yeast makes is governed by almost one thing alone: how warm it is allowed to stand.

{plate.hide 1.1} {compare part=20 "20 °C" ale Varm gjæring | Warm fermentation part=9 "9 °C" lager Kald gjæring | Cold fermentation mode=bar note=Samme malt, samme humle, samme gjærslekt. Elleve grader. | The same malt, the same hops, the same family of yeast. Eleven degrees.} Varmt gir frukt og krydder. Kaldt gir nesten ingenting.
> Warm gives fruit and spice. Cold gives almost none.
Og et øl der gjæren ikke sier noe, er et øl der malt og humle står helt alene.
> And a beer in which the yeast says nothing is a beer where malt and hops stand completely alone.
De to søylene der er hele resten av dette kurset. Det er en temperaturbryter, og den deler ølet i to.
> Those two bars are the entire rest of this course. It is a temperature switch, and it splits beer in two.

## Herfra betyr stedet noe | From here, the place matters

{compare.clear} {music bedBrew} {plate pub-lyst-og-morkt motion=right over=21 dim=0.12 push=0.13 into=1.4} Det var de fire. Vann, malt, humle og gjær.
> Those were the four. Water, malt, hops and yeast.
Og fire trinn: mesk, kok, gjæring og lagring. {stat 4 label=trinn fra korn til glass | steps from grain to glass side=neutral}
> And four steps: mash, boil, ferment and condition. {^}
Alt dette skjer likt, i et hvilket som helst bryggeri, hvor som helst i verden.
> All of that happens the same way, in any brewery, anywhere in the world.

{stat.clear} {plate.hide 1.1} {plate kjeller-kald motion=in over=31 dim=0.16 push=0.1 into=1.4} Men én av de fire kan ikke veies, og det er den som bestemmer mest.
> But one of the four cannot be weighed, and it is the one that decides the most.
Og fram til attenhundretallet kunne ingen se den, velge den eller kjøpe den. Man arvet den som allerede var i huset.
> And until the nineteenth century nobody could see it, choose it or buy it. You inherited whatever was already in the building.
Da blir spørsmålet: hva gjør folk som ikke kan styre sin viktigste ingrediens?
> Which leaves a question: what do people do when they cannot control their most important ingredient?

De styrer alt annet. Temperaturen i kjelleren, årstiden de brygger i, og vannet som ligger under byen.
> They control everything else. The temperature of the cellar, the season they brew in, and the water lying under the town.
{plate.hide 1.1} {plate pub-lyst-og-morkt motion=in over=14 dim=0.12 push=0.09 into=1.4} Og i samme øyeblikk begynner det å bety noe hvor i verden du står.
> And in that same moment it starts to matter where in the world you are standing.

Neste gang: gjæren som flyter opp, og en engelsk by der vannet gjorde halve jobben.
> Next time: the yeast that floats to the top, and an English town where the water did half the work.
