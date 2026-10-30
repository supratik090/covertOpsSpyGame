package com.spygame.covertops.util;

import com.spygame.covertops.model.GameSession;
import com.spygame.covertops.model.Node;
import com.spygame.covertops.model.ScenarioConfig;

import java.util.*;

public class SafehouseUtils {

    private static final Map<String, List<String>> DEFAULT_CITY_PLACES = new HashMap<>();

    static {
        DEFAULT_CITY_PLACES.put("mumbai", Arrays.asList("Colaba", "Dadar", "Goregaon", "Malad", "Ghatkopar"));
        DEFAULT_CITY_PLACES.put("new_delhi", Arrays.asList("Connaught Place", "Lajpat Nagar", "Hauz Khas", "Dwarka", "Karol Bagh"));
        DEFAULT_CITY_PLACES.put("delhi", Arrays.asList("Connaught Place", "Lajpat Nagar", "Hauz Khas", "Dwarka", "Karol Bagh"));
        DEFAULT_CITY_PLACES.put("amritsar", Arrays.asList("Golden Temple Environs", "Ranjit Avenue", "Civil Lines", "Chheharta", "Model Town"));
        DEFAULT_CITY_PLACES.put("srinagar", Arrays.asList("Lal Chowk", "Dal Gate", "Nishat", "Rajbagh", "Soura"));
        DEFAULT_CITY_PLACES.put("jammu", Arrays.asList("Gandhi Nagar", "Trikuta Nagar", "Bahu Fort Area", "Janipur", "Channi Himmat"));
        DEFAULT_CITY_PLACES.put("chandigarh", Arrays.asList("Sector 17", "Sector 35", "Elante District", "Sector 22", "Manimajra"));
        DEFAULT_CITY_PLACES.put("kolkata", Arrays.asList("Park Street", "Salt Lake", "Ballygunge", "New Town", "Howrah Gate"));
        DEFAULT_CITY_PLACES.put("dhaka", Arrays.asList("Gulshan", "Dhanmondi", "Banani", "Uttara", "Motijheel"));
        DEFAULT_CITY_PLACES.put("chittagong", Arrays.asList("Agrabad", "GEC Circle", "Halishahar", "Nasirabad", "Patenga"));
        DEFAULT_CITY_PLACES.put("sylhet", Arrays.asList("Zindabazar", "Chowhatta", "Ambarkhana", "Upattya", "Kumarpara"));
        DEFAULT_CITY_PLACES.put("rajshahi", Arrays.asList("Saheb Bazar", "Kazla", "Shiromoni", "Motihar", "Baluaghat"));
        DEFAULT_CITY_PLACES.put("moimonsingh", Arrays.asList("Town Hall Area", "Charpara", "Ganginarpar", "Kewatkhali", "Shambhuganj"));
        DEFAULT_CITY_PLACES.put("siliguri", Arrays.asList("Hill Cart Road", "Pradhan Nagar", "Hakim Para", "Matigara", "Sevoke Road"));
        DEFAULT_CITY_PLACES.put("guwahati", Arrays.asList("Ganeshguri", "Paltan Bazaar", "Zoo Road", "Dispur", "Fancy Bazaar"));
        DEFAULT_CITY_PLACES.put("patna", Arrays.asList("Boring Road", "Kankarbagh", "Patliputra Colony", "Frazer Road", "Rajendra Nagar"));
        DEFAULT_CITY_PLACES.put("tehran", Arrays.asList("Tajrish", "Valiasr", "Elahiyeh", "Niavaran", "Sa'adat Abad"));
        DEFAULT_CITY_PLACES.put("isfahan", Arrays.asList("Jolfa Quarter", "Naqsh-e Jahan", "Chahar Bagh", "Shahrestan", "Abbas Abad"));
        DEFAULT_CITY_PLACES.put("shiraz", Arrays.asList("Eram District", "Zand Boulevard", "Afif Abad", "Qasrodasht", "Gasr al-Dasht"));
        DEFAULT_CITY_PLACES.put("tabriz", Arrays.asList("El Goli", "Shahgoli", "Valiasr Tabriz", "Abresan", "Bazaar Quarter"));
        DEFAULT_CITY_PLACES.put("mashhad", Arrays.asList("Sajjad Boulevard", "Ahmadabad", "Khasravani", "Vakilabad", "Kuhsangi"));
        DEFAULT_CITY_PLACES.put("bandar_abbas", Arrays.asList("Kheshavarz", "Golshahr", "Nakhl-e Nakhoda", "Resalat", "Suru Beach"));
        DEFAULT_CITY_PLACES.put("chabahar", Arrays.asList("Free Trade Zone", "Shahrak-e Towhid", "Tis District", "Ramin Coast", "Beheshti Port"));
        DEFAULT_CITY_PLACES.put("kerman", Arrays.asList("Azadi Square", "Shariati", "Jomhuri Boulevard", "Havamani", "Ganjali Khan Area"));
        DEFAULT_CITY_PLACES.put("qom", Arrays.asList("Bajak", "Salariyeh", "Zembil Abad", "Somayyeh", "Pardisan"));
        DEFAULT_CITY_PLACES.put("tel_aviv", Arrays.asList("Rothschild Boulevard", "Florentin", "Neve Tzedek", "Jaffa Port", "Ramat Aviv"));
        DEFAULT_CITY_PLACES.put("jerusalem", Arrays.asList("Rehavia", "German Colony", "Talbiya", "Nachlaot", "Yemin Moshe"));
        DEFAULT_CITY_PLACES.put("haifa", Arrays.asList("German Colony", "Hadar HaCarmel", "Carmel Center", "Bat Galim", "Vadi Nisnas"));
        DEFAULT_CITY_PLACES.put("beersheba", Arrays.asList("Old City", "Ramot", "Neve Ze'ev", "Daled Quarter", "Bnei Shimon"));
        DEFAULT_CITY_PLACES.put("eilat", Arrays.asList("Marina District", "Shahamon", "Yaelim", "Coral Beach", "Industrial Zone"));
        DEFAULT_CITY_PLACES.put("beirut", Arrays.asList("Hamra", "Achrafieh", "Badaro", "Mar Mikhael", "Gemmayzeh"));
        DEFAULT_CITY_PLACES.put("damascus", Arrays.asList("Bab Touma", "Shaalan", "Malki", "Mezzeh", "Abbaseyyin"));
        DEFAULT_CITY_PLACES.put("baghdad", Arrays.asList("Karrada", "Mansour", "Jadriya", "Zeyouna", "Adhamiya"));
        DEFAULT_CITY_PLACES.put("dubai", Arrays.asList("Business Bay", "Deira", "Jumeirah", "Downtown Marina", "Al Fahidi"));
        DEFAULT_CITY_PLACES.put("abu_dhabi", Arrays.asList("Al Khalidiyah", "Corniche Area", "Al Reem Island", "Al Zahiyah", "Al Bateen"));
        DEFAULT_CITY_PLACES.put("hanoi", Arrays.asList("Old Quarter", "Tay Ho", "Ba Dinh", "Cau Giay", "Hoan Kiem"));
        DEFAULT_CITY_PLACES.put("ho_chi_minh", Arrays.asList("District 1", "Thao Dien", "District 3", "Phu Nhuan", "Binh Thanh"));
        DEFAULT_CITY_PLACES.put("ho_chi_minh_city", Arrays.asList("District 1", "Thao Dien", "District 3", "Phu Nhuan", "Binh Thanh"));
        DEFAULT_CITY_PLACES.put("phnom_penh", Arrays.asList("Boeung Keng Kang", "Daun Penh", "Toul Tom Poung", "7 Makara", "Chroy Changvar"));
        DEFAULT_CITY_PLACES.put("naypyidaw", Arrays.asList("Zabuthiri", "Ottarathiri", "Dekkhinathiri", "Pobbathiri", "Pygimana"));
        DEFAULT_CITY_PLACES.put("yangon", Arrays.asList("Dagon", "Bahan", "Kamayut", "Kyauktada", "Sanchaung"));
        DEFAULT_CITY_PLACES.put("bangkok", Arrays.asList("Sukhumvit", "Silom", "Sathorn", "Siam", "Chatuchak"));
        DEFAULT_CITY_PLACES.put("kuala_lumpur", Arrays.asList("KLCC", "Bukit Bintang", "Bangsar", "Mont Kiara", "Cheras"));
        DEFAULT_CITY_PLACES.put("singapore", Arrays.asList("Orchard", "Marina Bay", "Bugis", "Tampines", "Jurong"));
        DEFAULT_CITY_PLACES.put("jakarta", Arrays.asList("Menteng", "Kuningan", "SCBD", "Kemang", "Pondok Indah"));
        DEFAULT_CITY_PLACES.put("bali", Arrays.asList("Seminyak", "Canggu", "Ubud", "Sanur", "Nusa Dua"));
    }

    public static String pickSubLocality(String cityNode, ScenarioConfig config, List<GameSession.Safehouse> existingSafehouses) {
        if (cityNode == null) return "Central Sector";
        String normalizedCity = cityNode.toLowerCase().trim();

        List<String> places = null;
        if (config != null && config.getNodes() != null) {
            Node node = config.getNodes().stream()
                    .filter(n -> n.getId() != null && n.getId().equalsIgnoreCase(normalizedCity))
                    .findFirst()
                    .orElse(null);
            if (node != null && node.getPlaces() != null && !node.getPlaces().isEmpty()) {
                places = node.getPlaces();
            }
        }

        if (places == null || places.isEmpty()) {
            places = DEFAULT_CITY_PLACES.getOrDefault(normalizedCity, Arrays.asList(
                    "Central Sector", "Old Town District", "North Enclave", "Harbor Outpost", "East Avenue"
            ));
        }

        long existingCount = (existingSafehouses == null) ? 0 : existingSafehouses.stream()
                .filter(s -> s.getCityNode() != null && s.getCityNode().equalsIgnoreCase(normalizedCity))
                .count();

        int index = (int) (existingCount % places.size());
        return places.get(index);
    }

    public static void ensureAllSafehousesHavePlaces(GameSession session, ScenarioConfig config) {
        if (session == null || session.getSafehouses() == null) return;
        List<GameSession.Safehouse> safehouses = session.getSafehouses();
        for (int i = 0; i < safehouses.size(); i++) {
            GameSession.Safehouse sh = safehouses.get(i);
            if (sh.getSubLocality() == null || sh.getSubLocality().trim().isEmpty()) {
                List<GameSession.Safehouse> prior = safehouses.subList(0, i);
                sh.setSubLocality(pickSubLocality(sh.getCityNode(), config, prior));
            }
        }
    }
}
