import { Link } from "react-router-dom";

interface CartItemImageProps {
  productId: string;
  image: string;
  title: string;
  isDiscounted: boolean;
  discountPercentage: number;
}

export const CartItemImage = ({
  productId,
  image,
  title,
  isDiscounted,
  discountPercentage,
}: CartItemImageProps) => {
  return (
    <div className="relative shrink-0 w-full sm:w-44 aspect-square">
      <Link 
        to={`/product/${productId}`} 
        className="block h-full w-full overflow-hidden rounded-2xl shadow-inner border border-border/20 group/img"
      >
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover/img:scale-110"
          loading="lazy"
        />
      </Link>

      {isDiscounted && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <div className="bg-destructive/90 text-white text-[10px] font-black px-2 py-1 rounded-lg backdrop-blur-md shadow-lg border border-white/20">
            -{discountPercentage}%
          </div>
        </div>
      )}
    </div>
  );
};
