import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const proTeam = [
  {
    name: "Riley Dillon",
    imagePath: "/team/pro/riley-dillon.jpg",
    imagePosition: "center 35%",
    bio: "22-year-old Canadian wakeboarding star with a snowboard-inspired style. 5-time National champ, mentor, and dedicated to advancing the sport through innovation and guidance"
  },
  {
    name: "Aleksa Sanchez",
    imagePath: "/team/pro/aleksa-sanchez.png",
    imagePosition: "center 25%",
    bio: "Aleksa Sanchez, Miami and Cancun-based multi-sport watersports pro, began wakeboarding and kiteboarding 11 years ago. She's competed in 100+ global events, now an internationally recognized coach and influencer in the watersports scene."
  },
  {
    name: "Derek Huntoon (Pontoon)",
    imagePath: "/team/pro/derek-huntoon.jpg",
    imagePosition: "center 30%",
    bio: "Derek, a Michigan-based boardsport athlete, turned pro wakeboarder 5 years ago. With a pro model board by Progress Wakeboards, he shifted from competition to film and editing, emphasizing quality and style. He recently won his first long-form winch part, \"Pontoon,\" locally. Derek is excited about his partnership with Flyhigh and the sport's evolving direction."
  },
  {
    name: "Peacock Brothers",
    imagePath: "/team/pro/peacock-brothers.jpg",
    imagePosition: "center 35%",
    bio: "You probably know them from their popular wakeboard Youtube Channel or their world-wide training camps. Ryan is a three-time British Champion and Liam is a two-time World Champion. Their new training program \"Road to Pro\" is helping people across the world grow their skills."
  },
  {
    name: "John Haile",
    imagePath: "/team/pro/john-haile.png",
    imagePosition: "center 25%",
    bio: "Hailing from Orlando, Florida, John is fully immersed in the world of towed watersports. His expertise extends beyond being a professional kneeboarder; John is also a proficient wakeboard instructor, navigating the waters with passion and sharing his extensive knowledge, John hosts an engaging YouTube channel, inviting audiences to join him in discovering the awesome world of towed watersports."
  }
];

const advancedTeam = [
  {
    name: "Isabella Zulian",
    imagePath: "/team/advanced/isabella-zulian.jpg",
    imagePosition: "center 28%",
    bio: "I currently live in Gold Coast, Australia. I've been wakeboarding for the last 4 years and absolutely love the sport. I'm predominantly a boat rider, however I do enjoy to ride cable also. My latest achievements have been Jnr Women 2023 Australian Champion, NSW Wakeboard State Champion, and 4th in 2023 WWA World Championships in Portugal. My overall goal is to be the best I can be and to also inspire younger riders to join this amazing sport."
  },
  {
    name: "Cole Black",
    imagePath: "/team/advanced/cole-black.jpg",
    imagePosition: "center 30%",
    bio: "I am a wakeboarder from Jackson, Ga. This is my fifth year of wakeboarding. Throughout my childhood I have always gone to the lake with friends and family. My dad, brother, and his friends were always wakeboarding when we would go out. It took me many times of trying before I was able to get up on the board, but once I figured it out I was hooked. At 11 years old I knew wakeboarding would be in my future. So now my main priority is building a name for myself in the sport and becoming a better and more consistent contest rider. My favorite trick is a whirly or wrapped KGB."
  },
  {
    name: "Braden Smithwick",
    imagePath: "/team/advanced/braden-smithwick.jpg",
    imagePosition: "center 32%",
    bio: "I am a wakeboarder from Washington, NC. I started wakeboarding when I was 9 years old and haven't looked back since. Most of my younger career was spent riding behind center console fish boats. Now that I have started riding wake boats in the last 2 years, my riding has taken off. I plan to get on the cable more so I can advance there. Now, I am working on toe 7s and double back rolls. My favorite trick is a switch heelside Indy 540. The things I love most about wakeboarding are the community, competitions, and memories made on the water."
  }
];

const beginnerTeam = [
  {
    name: "Nevin Garber",
    imagePath: "/team/beginner/nevin-garber.jpg",
    imagePosition: "center 28%",
    bio: "A 17-year-old rider from Dundee, Ohio. Nevin rides mostly boat but also enjoys cable. He started boarding when he was 10 but didn't start riding regularly until last year. Now his riding has really taken off. He's already locked in a couple new inverts and is looking forward to going all the way to the top and meeting new people along the way."
  },
  {
    name: "Mackenzie Mews",
    imagePath: "/team/beginner/mackenzie-mews.jpg",
    imagePosition: "center 30%",
    bio: "An enthusiastic boat wakeboarder from Western Australia who is progressing in the sport, she is on a continuous learning journey. Mackenzie first started in 2020 and wasn't riding very regularly, but got a wake boat in 2022 and started wanting to push herself by going bigger and trying new stuff. Her favorite thing about wakeboarding is the community and the support from each other, and her favorite trick is a half cab. She is excited for a future which will be full of lots of experiences, excitement, falls, and meeting more people along the way."
  }
];

function RiderCard({
  name,
  imagePath,
  imagePosition,
  bio
}: {
  name: string;
  imagePath: string;
  imagePosition?: string;
  bio: string;
}) {
  return (
    <article className="rider-card">
      <div className="rider-card__image-wrap">
        <Image
          src={imagePath}
          alt={name}
          fill
          sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 50vw, 33vw"
          className="rider-card__image"
          style={{ objectPosition: imagePosition ?? "center" }}
        />
      </div>
      <div className="rider-card__body">
        <h3>{name}</h3>
        <p>{bio}</p>
      </div>
    </article>
  );
}

export default function TeamPage() {
  return (
    <main className="page team-page">
      <section className="watch-hero team-page__hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="team-page__intro">
            <h1>FlyHighTV Sponsored Riding Team</h1>
            <p className="watch-copy">
              FlyHighTV is excited to introduce our very own sponsored riding team. Learn more about our riders below.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--header-primary" href="/get-sponsored">Get Sponsored</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content">
          <div className="team-section-head">
            <h2>Pro Team</h2>
          </div>
          <div className="rider-grid rider-grid--pro">
            {proTeam.map((rider) => (
              <RiderCard key={rider.name} {...rider} />
            ))}
          </div>
        </div>
      </section>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content">
          <div className="team-section-head">
            <h2>Advanced Riding Team</h2>
            <p>Check out our up and coming riders in the sport.</p>
          </div>
          <div className="rider-grid rider-grid--advanced">
            {advancedTeam.map((rider) => (
              <RiderCard key={rider.name} {...rider} />
            ))}
          </div>
        </div>
      </section>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content">
          <div className="team-section-head">
            <h2>Beginning Rider Team</h2>
            <p>Check out our beginner team that's hyped to ride</p>
          </div>
          <div className="rider-grid rider-grid--beginner">
            {beginnerTeam.map((rider) => (
              <RiderCard key={rider.name} {...rider} />
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
