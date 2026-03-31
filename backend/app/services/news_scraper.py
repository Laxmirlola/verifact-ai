from typing import List
from app.models import NewsArticle

def get_sample_news_articles() -> List[NewsArticle]:
    """Get sample news articles for testing"""
    
    sample_articles = [
        NewsArticle(
            title="Climate Change Report Shows Rising Global Temperatures",
            content="A new comprehensive study by international climate scientists reveals that global temperatures have risen by 1.2 degrees Celsius since pre-industrial times. The report, published in Nature Climate Change, analyzed temperature data from thousands of monitoring stations worldwide. Scientists warn that without immediate action, temperatures could rise by 2-3 degrees by 2100, leading to severe consequences including rising sea levels, extreme weather events, and ecosystem disruptions.",
            source="Reuters",
            url="https://reuters.com/climate-report-2024"
        ),
        NewsArticle(
            title="New Study Links Vitamin D Deficiency to Health Risks",
            content="Researchers at Harvard Medical School have published findings showing a strong correlation between vitamin D deficiency and various health conditions. The study, which followed 50,000 participants over 10 years, found that individuals with low vitamin D levels had higher rates of cardiovascular disease, diabetes, and certain cancers. Experts recommend regular testing and supplementation where necessary.",
            source="BBC Health",
            url="https://bbc.com/health/vitamin-d-study"
        ),
        NewsArticle(
            title="Economic Growth Slows in Major Economies",
            content="The International Monetary Fund reports that economic growth is slowing across major global economies. GDP growth in the United States is projected at 2.1%, while the Eurozone faces challenges with growth expected at 1.3%. China's economy is also experiencing a slowdown with growth forecasts revised down to 4.5%. Factors include inflation pressures, supply chain disruptions, and monetary policy tightening.",
            source="The Hindu Business",
            url="https://thehindu.com/business/economic-growth-2024"
        ),
        NewsArticle(
            title="Breakthrough in Renewable Energy Storage Technology",
            content="Scientists at MIT have developed a new battery technology that could revolutionize renewable energy storage. The innovation uses sustainable materials and provides three times the energy density of current lithium-ion batteries. This breakthrough could make solar and wind power more viable by solving the intermittency problem. The technology is expected to reach commercial scale within five years.",
            source="Associated Press",
            url="https://ap.org/renewable-energy-breakthrough"
        ),
        NewsArticle(
            title="COVID-19 Vaccination Rates Decline Globally",
            content="The World Health Organization reports a concerning decline in COVID-19 vaccination rates worldwide. While initial vaccination campaigns were successful, booster uptake has dropped significantly. Health officials attribute this to pandemic fatigue and misinformation. The WHO emphasizes the importance of continued vaccination, especially for vulnerable populations, as new variants continue to emerge.",
            source="BBC News",
            url="https://bbc.com/news/covid-vaccination-2024"
        )
    ]
    
    return sample_articles