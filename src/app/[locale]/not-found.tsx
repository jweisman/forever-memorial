import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Card from "@/components/ui/Card";

export default function NotFoundPage() {
  const t = useTranslations("NotFound");

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <Card>
        <h1 className="font-heading text-2xl font-semibold text-warm-800">
          {t("title")}
        </h1>
        <p className="mt-4 text-warm-600">{t("message")}</p>
        <div className="mt-6">
          <Link
            href="/"
            className="text-sm text-accent hover:text-accent-hover"
          >
            &larr; {t("backHome")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
