import { useMemo, useState } from "react";
import { BedDouble, Bath, ExternalLink, Filter, MapPin, ShieldCheck, Star } from "lucide-react";
import type { AirbnbSearchResult } from "../../../server/services/hotels/airbnb-serpapi";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export default function AirbnbResults({ result }: { result: AirbnbSearchResult }) {
  const [sort, setSort] = useState<"recommended" | "price" | "rating">("recommended");
  const [maxPrice, setMaxPrice] = useState("");
  const listings = useMemo(() => {
    const max = maxPrice ? Number(maxPrice) : undefined;
    return result.listings.filter((listing) => max === undefined || (listing.totalPrice !== undefined && listing.totalPrice <= max)).sort((left, right) => {
      if (sort === "price") return (left.totalPrice ?? Number.MAX_SAFE_INTEGER) - (right.totalPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === "rating") return (right.rating ?? -1) - (left.rating ?? -1);
      return 0;
    });
  }, [maxPrice, result.listings, sort]);

  return <section className="airbnb-results" aria-live="polite">
    <div className="airbnb-results-head"><div><span className="eyebrow">AIRBNB · SERPAPI</span><h3>{listings.length} {listings.length === 1 ? "hospedagem encontrada" : "hospedagens encontradas"}</h3><p>Resultados para {result.queriedLocation}. Valores retornados pela fonte em reais; confirme o total e a disponibilidade no Airbnb.</p></div><label className="airbnb-sort-control"><span>Ordenar</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recommended">Recomendados</option><option value="price">Menor preço</option><option value="rating">Melhor avaliação</option></select></label></div>
    <div className="airbnb-filter-bar"><span><Filter size={14} /> Filtrar resultados</span><label>Preço máximo<input inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Sem limite (R$)" /></label><small>Consulta: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(result.lastCheckedAt))}</small></div>
    {listings.length === 0 ? <div className="empty-results"><div><strong>{result.listings.length === 0 ? "A fonte não retornou hospedagens" : "Nenhuma hospedagem corresponde ao filtro"}</strong><p>{result.listings.length === 0 ? "Tente outra cidade ou período. Nenhum anúncio foi criado ou completado pela PIPER." : "Aumente o preço máximo ou remova o filtro."}</p></div></div> : <div className="airbnb-listing-grid">{listings.map((listing) => <article className="airbnb-listing-card" key={listing.id}>
      <div className="airbnb-listing-image">{listing.thumbnail ? <img src={listing.thumbnail} alt={listing.name} loading="lazy" /> : <div className="airbnb-image-placeholder"><MapPin size={24} /><span>Imagem não informada pela fonte</span></div>}{listing.badges.length > 0 && <span className="airbnb-listing-badge">{listing.badges[0]}</span>}</div>
      <div className="airbnb-listing-body"><div className="airbnb-listing-title"><div><span className="airbnb-property-type">{listing.title || "Hospedagem Airbnb"}</span><h4>{listing.name}</h4></div>{listing.rating !== undefined && <span className="airbnb-rating"><Star size={14} fill="currentColor" /> {listing.rating.toLocaleString("pt-BR")}</span>}</div>
        {listing.reviewCount !== undefined && <p className="airbnb-review-count">{listing.reviewCount.toLocaleString("pt-BR")} avaliações</p>}
        {listing.description && <p className="airbnb-description">{listing.description}</p>}
        <div className="airbnb-features">{listing.bedrooms !== undefined && <span><BedDouble size={14} /> {listing.bedrooms} {listing.bedrooms === 1 ? "quarto" : "quartos"}</span>}{listing.beds !== undefined && <span><BedDouble size={14} /> {listing.beds} {listing.beds === 1 ? "cama" : "camas"}</span>}{listing.bathrooms !== undefined && <span><Bath size={14} /> {listing.bathrooms} {listing.bathrooms === 1 ? "banheiro" : "banheiros"}</span>}{listing.freeCancellation && <span><ShieldCheck size={14} /> Cancelamento grátis</span>}</div>
        {listing.highlights.length > 0 && <div className="airbnb-highlights">{listing.highlights.slice(0, 2).map((highlight) => <span key={highlight}>{highlight}</span>)}</div>}
        <div className="airbnb-listing-bottom"><div className="airbnb-listing-price">{listing.totalPrice !== undefined ? <>{listing.nightlyPrice !== undefined && <small>{formatBRL(listing.nightlyPrice)} / noite</small>}<strong>{formatBRL(listing.totalPrice)}</strong><span>{listing.checkInDate && listing.checkOutDate ? `${formatDate(listing.checkInDate)} a ${formatDate(listing.checkOutDate)}` : listing.priceQualifier && !/^total:?$/i.test(listing.priceQualifier) ? listing.priceQualifier : "total informado para a estadia"}</span></> : <><strong>Preço indisponível</strong><span>Consulte o valor final no Airbnb</span></>}</div><a className="airbnb-open-link" href={listing.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Ver no Airbnb</a></div>
      </div>
    </article>)}</div>}
  </section>;
}
