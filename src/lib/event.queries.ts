import { queryOptions } from "@tanstack/react-query";
import { getFeaturedEvent, getTicket } from "./event.functions";

export const eventQueryOptions = () =>
  queryOptions({
    queryKey: ["event", "featured"],
    queryFn: () => getFeaturedEvent(),
    staleTime: 30_000,
  });

export const ticketQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ["ticket", token],
    queryFn: () => getTicket({ data: { token } }),
  });
