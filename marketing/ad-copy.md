# Ad copy

Drafted, not chosen. Every claim here is on the live site — `$40` and the free
trial from `lessons.html`, the 10+ years and the voice from `index.html` and
`about.html`, the subject list from `instruments.html` / `digital-media.html`.
Nothing below says anything the site does not.

## How Meta uses these three fields

| Field | Where it shows | Practical limit |
|---|---|---|
| **Primary text** | above the video in Feed; mostly hidden in Reels/Stories | first ~125 characters before "See more" on mobile — put the offer in them |
| **Headline** | under the video, next to the CTA button | ~27–40 characters before it clips |
| **Description** | Feed and right column only; **not** shown in Reels or Stories | ~27 characters; treat it as optional |

Because Reels and Stories drop the description and bury the primary text, the
9:16 placement is carried almost entirely by the video. That is the whole
argument for the offer-first cut.

## Primary text

1. Your first lesson is free. Music and digital media lessons in Portland, for
   all ages and every skill level — drums, guitar, bass, piano, synths,
   production, animation, video, photo. $40 per half hour after that.

2. Every new student gets a free trial lesson. No cost, no commitment — it's
   just the best way to find out if we're a good fit. Home studio in Portland,
   all ages welcome.

3. No books. No recitals. Just the songs you actually want to play. First
   lesson free, $40 per half hour after that, Portland OR.

4. I've spent more than 10 years helping students go from "I have no idea what
   I'm doing" to proud of something they made. Your first lesson is free —
   come find out what you'd like to make.

5. Guitar? Drums? Or the whole studio — recording, production, animation,
   video? Pick anything. First trial lesson is free, and we'll work out where
   to start together. Portland, OR.

## Headlines

1. First Trial Lesson Is Free
2. Free Trial Lesson In Portland
3. Music Lessons, Portland OR
4. Your First Lesson Is On Me
5. Book A Free Trial Lesson

## Descriptions

1. $40 per half hour
2. All ages, all skill levels
3. Home studio in Portland
4. No books, no recitals
5. Drums, guitar, piano & more

## What to pair with what

Run one ad set with three or four ads in it and let Meta rotate them. The
video is the variable worth testing, so hold the copy steady across the two
cuts of the same ad:

- **Offer-first cut** + primary text **1** + headline **1** + description **1**
- **Full cut** + primary text **1** + headline **1** + description **1**
- **Static frame** (previewer → "Save this frame" on the offer scene)
  + primary text **3** + headline **5** + description **2**

That way the cut is the only thing changing between the first two, and any
difference in cost per landing-page view is actually about the edit.

## Destination

`https://samhall.music/lessons.html` — the page with the booking widget on it,
not the home page, because the ad says BOOK NOW.

Add UTMs so the visit is identifiable in anything other than Meta's own
reporting:

```
https://samhall.music/lessons.html?utm_source=facebook&utm_medium=cpc&utm_campaign=trial-2026-09&utm_content=offerfirst-9x16
```

Change `utm_content` per ad. Meta has a "URL parameters" box at the ad level —
put everything after the `?` in there rather than in the destination field.

## Call to action button

**Book Now.** "Learn More" gets cheaper clicks from people who are only
browsing; the offer here is concrete enough to ask for the booking.
