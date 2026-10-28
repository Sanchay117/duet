import type { Domain, Entity } from "./types";

export function domainOf(e: Entity): Domain {
  switch (e.kind) {
    case "artist":
      return "music";
    case "movie":
      return "film";
    case "tv_show":
      return "tv";
    case "book":
      return "books";
    case "place":
      return "home";
    default:
      return "stars";
  }
}
