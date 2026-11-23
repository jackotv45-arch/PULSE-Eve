import { queryOptions } from "@tanstack/react-query";
import { getPublicEvent, getTicket } from "./event.functions";

export const eventQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["event", slug],
    queryFn: () => getPublicEvent({ data: { slug } }),
    staleTime: 30_000,
  });

export const ticketQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ["ticket", token],
    queryFn: () => getTicket({ data: { token } }),
  });
