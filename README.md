# Cat Feeding Schedule App

A React application for coordinating cat feeding schedules among neighbors with real-time synchronization using Supabase.

## Features

- 📅 Schedule management for morning and evening feedings
- 👥 Multi-user support with name selection
- ✅ Mark feedings as completed
- 🔄 Real-time synchronization across all users
- 📱 Responsive design for mobile and desktop

## Setup Instructions

### 1. Supabase Setup

1. **Create a Supabase account and project:**
   - Go to [https://supabase.com](https://supabase.com)
   - Sign up for free
   - Create a new project (remember your database password!)
   - Wait for the project to initialize (~2 minutes)

2. **Get your project credentials:**
   - In your project dashboard, go to Settings → API
   - Copy your project URL (looks like: `https://xxxxx.supabase.co`)
   - Copy your anon/public API key (safe to use in frontend)

3. **Create the database table:**
   - Go to SQL Editor in your Supabase dashboard
   - Run the SQL script provided in the setup (see SQL section below)

### 2. Local Development

1. **Clone and install dependencies:**
   ```bash
   cd cat-feeding-app
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Start the development server:**
   ```bash
   pnpm run dev
   ```

### 3. Deployment Options

#### Option A: Vercel (Recommended - Free)
1. Push this code to a GitHub repository
2. Go to [https://vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL` = your_supabase_url
   - `VITE_SUPABASE_ANON_KEY` = your_anon_key
5. Deploy!

#### Option B: Netlify (Also Free)
1. Build the project: `pnpm run build`
2. Go to [https://netlify.com](https://netlify.com)
3. Drag and drop the `dist` folder to Netlify Drop
4. Or connect your GitHub repository for automatic deployments

#### Option C: Static Hosting
1. Build the project: `pnpm run build`
2. Upload the `dist` folder contents to any static hosting service

## SQL Database Schema

Run this SQL script in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS feeding_schedule (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  time_slot VARCHAR(10) NOT NULL CHECK (time_slot IN ('morning', 'evening')),
  person VARCHAR(50),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (date, time_slot)
);

ALTER TABLE feeding_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view schedule"
  ON feeding_schedule FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Anyone can claim slots"
  ON feeding_schedule FOR INSERT TO PUBLIC WITH CHECK (true);

CREATE POLICY "Anyone can update slots"
  ON feeding_schedule FOR UPDATE TO PUBLIC USING (true);

CREATE POLICY "Anyone can unclaim slots"
  ON feeding_schedule FOR DELETE TO PUBLIC USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feeding_schedule_updated_at
BEFORE UPDATE ON feeding_schedule
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE feeding_schedule;
```

## How to Use

1. **Select your name** from the available options
2. **Click on any morning or evening slot** to claim it for feeding
3. **Click again to unclaim** if you need to change your schedule
4. **Use the circle button** to mark a feeding as completed
5. **Changes sync automatically** for all users in real-time!

## Technical Details

- **Frontend:** React with Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Supabase Realtime subscriptions

## Security Notes

- The anon key is safe to expose (it's meant for frontend use)
- Row Level Security (RLS) is enabled for data protection
- For production use, consider adding user authentication

## Optional Enhancements

- Add user authentication for more security
- Add email/SMS notifications when someone claims a slot
- Add a history log of who fed the cat when
- Add notes field for special instructions
- Add photo upload to confirm feeding

## Support

If you encounter any issues, check:
1. Your Supabase credentials are correct
2. The database table was created successfully
3. Your internet connection is stable
4. Browser console for any error messages

# cat-feeding-app
