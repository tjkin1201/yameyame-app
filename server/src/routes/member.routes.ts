import { Router, Request, Response } from 'express';
import Member, { IMember } from '../models/Member.model';

const router = Router();

// GET /api/members - 회원 목록 조회
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, isActive, sortBy = 'elo', order = 'desc', limit = 50, offset = 0 } = req.query;

    const filter: any = {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const sort: any = {};
    sort[sortBy as string] = order === 'asc' ? 1 : -1;

    const members = await Member.find(filter)
      .sort(sort)
      .limit(Number(limit))
      .skip(Number(offset))
      .select('-eloHistory');

    const total = await Member.countDocuments(filter);

    return res.status(200).json({
      members,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch members', details: (error as Error).message });
  }
});

// GET /api/members/:id - 회원 상세 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    return res.status(200).json(member);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch member', details: (error as Error).message });
  }
});

// POST /api/members - 회원 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const memberData: Partial<IMember> = req.body;

    // 필수 필드 검증
    if (!memberData.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // 중복 체크 (bandId가 있는 경우)
    if (memberData.bandId) {
      const existing = await Member.findOne({ bandId: memberData.bandId });
      if (existing) {
        return res.status(409).json({ error: 'Member with this bandId already exists' });
      }
    }

    const member = new Member(memberData);
    await member.save();

    return res.status(201).json(member);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create member', details: (error as Error).message });
  }
});

// PUT /api/members/:id - 회원 정보 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    // elo, eloHistory, stats는 직접 수정 불가 (게임 결과로만 변경)
    delete updates.elo;
    delete updates.eloHistory;
    delete updates.stats;
    delete updates.createdAt;
    delete updates.updatedAt;

    const member = await Member.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    return res.status(200).json(member);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update member', details: (error as Error).message });
  }
});

// DELETE /api/members/:id - 회원 삭제 (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { hard } = req.query;

    if (hard === 'true') {
      // Hard delete
      const member = await Member.findByIdAndDelete(req.params.id);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      return res.status(200).json({ message: 'Member permanently deleted', member });
    } else {
      // Soft delete
      const member = await Member.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      return res.status(200).json({ message: 'Member deactivated', member });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete member', details: (error as Error).message });
  }
});

// GET /api/members/:id/history - 회원 ELO 히스토리 조회
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id).populate('eloHistory.gameId', 'date type');
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    return res.status(200).json({
      memberId: member._id,
      name: member.name,
      currentElo: member.elo,
      highestElo: member.highestElo,
      lowestElo: member.lowestElo,
      history: member.eloHistory,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch history', details: (error as Error).message });
  }
});

// GET /api/members/leaderboard - 리더보드 조회
router.get('/stats/leaderboard', async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.query;

    const leaderboard = await Member.find({ isActive: true })
      .sort({ elo: -1 })
      .limit(Number(limit))
      .select('name elo level position stats profileImage');

    return res.status(200).json({ leaderboard, total: leaderboard.length });
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'Failed to fetch leaderboard', details: (error as Error).message });
  }
});

export default router;
